use std::collections::{BTreeSet, HashMap};
use std::io;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::future::join_all;
use serde_json::{Value, json};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use super::Plugin;
use crate::host::Wake;
use crate::secrets;

/// How often the searches run again.
/// ponytail: a fixed interval; GitHub's search API sends no X-Poll-Interval,
/// and 3 searches a minute stay well under its 30-a-minute limit.
const EVERY: Duration = Duration::from_secs(90);

/// GitHub searches for the new tab's GitHub widgets: each widget sends the
/// queries it shows (`{ topic: "github", command: "queries", widget, queries }`,
/// replacing that widget's last list), and this runs every widget's, with the
/// token from the first of:
///
/// 1. the `github` secret alias (see `secrets.rs`)
/// 2. `GH_TOKEN` or `GITHUB_TOKEN`
/// 3. `gh auth token`
/// 4. git's credential helper for github.com, with prompts off
///
/// The token stays here. The value is only the results, per query.
pub struct GitHub {
    state: Mutex<State>,
    http: reqwest::Client,
}

#[derive(Default)]
struct State {
    // widget id -> its queries.
    queries: HashMap<String, Vec<String>>,
    // query -> (ETag, the last result), so an unchanged search is a 304,
    // which doesn't count against the rate limit.
    cache: HashMap<String, (String, Value)>,
    token: Option<(String, &'static str)>,
}

impl GitHub {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(State::default()),
            http: client(),
        }
    }
}

#[async_trait]
impl Plugin for GitHub {
    fn topic(&self) -> &'static str {
        "github"
    }

    fn start(&self, wake: Wake) {
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(EVERY).await;
                if !wake.refresh() {
                    break;
                }
            }
        });
    }

    async fn command(&self, message: &Value) -> io::Result<()> {
        let mut state = self.state.lock().unwrap();
        match message["command"].as_str() {
            Some("queries") => {
                let widget = message["widget"].as_str().unwrap_or_default().to_owned();
                let queries = message["queries"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|q| {
                        q.as_str()
                            .map(str::trim)
                            .filter(|q| !q.is_empty())
                            .map(str::to_owned)
                    })
                    .collect();
                state.queries.insert(widget, queries);
            }
            // Drop the cached token too: the user may have just logged in.
            Some("refresh") => state.token = None,
            _ => return Err(io::Error::other(format!("unknown command {message}"))),
        }
        Ok(())
    }

    async fn read(&self) -> io::Result<Value> {
        // What to search and with what, taken out so the lock isn't held
        // across the requests.
        let (queries, cached, known) = {
            let mut state = self.state.lock().unwrap();
            let queries: BTreeSet<String> = state.queries.values().flatten().cloned().collect();
            // Results for searches nothing asks for any more are dropped.
            state.cache.retain(|q, _| queries.contains(q));
            (queries, state.cache.clone(), state.token.clone())
        };
        if queries.is_empty() {
            return Ok(json!({ "results": {} }));
        }
        let token = match known {
            Some(t) => Some(t),
            None => token().await,
        };
        let Some((token, from)) = token else {
            return Ok(json!({
                "results": {},
                "error": "No GitHub token. Log in with `gh auth login`, set GH_TOKEN, or add a `github` secret (see the handbook's GitHub chapter).",
            }));
        };
        let answers = join_all(queries.iter().map(|q| {
            let etag = cached.get(q).map(|(etag, _)| etag.as_str());
            search(&self.http, &token, q, etag)
        }))
        .await;

        let mut state = self.state.lock().unwrap();
        state.token = Some((token, from));
        let mut results = serde_json::Map::new();
        for (q, answer) in queries.into_iter().zip(answers) {
            match answer {
                Ok(Some((etag, value))) => {
                    state.cache.insert(q.clone(), (etag, value.clone()));
                    results.insert(q, value);
                }
                Ok(None) => {
                    let old = cached.get(&q).map(|(_, v)| v.clone());
                    results.insert(q, old.unwrap_or(Value::Null));
                }
                Err(e) => {
                    if e.to_string().contains("401") {
                        state.token = None;
                    }
                    results.insert(q, json!({ "error": e.to_string() }));
                }
            }
        }
        Ok(json!({ "results": results, "auth": from }))
    }
}

/// The HTTP client the network plugins share the settings of: a timeout, so
/// a request that hangs gives up, and a name, which GitHub and LRCLIB ask for.
pub fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("caelestia-tab (https://git.hu-tao.dev/hutao/caelestia-tab)")
        .build()
        .expect("an HTTP client with a timeout and a name")
}

/// One search, or None when it hasn't changed since `etag`.
async fn search(
    http: &reqwest::Client,
    token: &str,
    q: &str,
    etag: Option<&str>,
) -> io::Result<Option<(String, Value)>> {
    let mut request = http
        .get("https://api.github.com/search/issues")
        .query(&[("q", q), ("sort", "updated"), ("per_page", "20")])
        .bearer_auth(token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28");
    if let Some(etag) = etag {
        request = request.header("If-None-Match", etag);
    }
    let response = request.send().await.map_err(io::Error::other)?;
    let status = response.status().as_u16();
    if status == 304 {
        return Ok(None);
    }
    let etag = response
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    let text = response.text().await.map_err(io::Error::other)?;
    let body: Value = serde_json::from_str(&text)?;
    if status != 200 {
        let message = body["message"].as_str().unwrap_or("request failed");
        return Err(io::Error::other(format!("GitHub said {status}: {message}")));
    }
    Ok(Some((etag, items(&body))))
}

/// The parts of a search result the widget shows.
fn items(body: &Value) -> Value {
    let items: Vec<Value> = body["items"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|it| {
            let repo = it["repository_url"]
                .as_str()
                .and_then(|u| u.strip_prefix("https://api.github.com/repos/"))
                .unwrap_or_default();
            json!({
                "title": it["title"],
                "url": it["html_url"],
                "repo": repo,
                "number": it["number"],
                "pr": it.get("pull_request").is_some(),
                "draft": it["draft"].as_bool().unwrap_or(false),
                "author": it["user"]["login"],
                "comments": it["comments"],
                "updated": it["updated_at"],
            })
        })
        .collect();
    json!({ "total": body["total_count"], "items": items })
}

/// The first token found, and where it came from.
async fn token() -> Option<(String, &'static str)> {
    let found = |v: String| Some(v.trim().to_owned()).filter(|v| !v.is_empty());
    // The secret may run sops or a command of the user's: off the runtime.
    if let Ok(Ok(Some(v))) = tokio::task::spawn_blocking(|| secrets::get("github")).await {
        return found(v).map(|v| (v, "secret"));
    }
    for var in ["GH_TOKEN", "GITHUB_TOKEN"] {
        if let Some(v) = std::env::var(var).ok().and_then(found) {
            return Some((v, "env"));
        }
    }
    if let Ok(out) = Command::new("gh").args(["auth", "token"]).output().await
        && out.status.success()
        && let Some(v) = found(String::from_utf8_lossy(&out.stdout).into_owned())
    {
        return Some((v, "gh"));
    }
    git_credential().await.map(|v| (v, "git"))
}

/// git's stored credential for github.com. Prompts are off, so a helper that
/// would ask (a terminal prompt, Git Credential Manager's window) answers
/// nothing instead of popping up.
async fn git_credential() -> Option<String> {
    let mut child = Command::new("git")
        .args(["-c", "credential.interactive=false", "credential", "fill"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never")
        .env_remove("GIT_ASKPASS")
        .env_remove("SSH_ASKPASS")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let mut stdin = child.stdin.take()?;
    stdin
        .write_all(b"protocol=https\nhost=github.com\n\n")
        .await
        .ok()?;
    drop(stdin);
    let out = child.wait_with_output().await.ok()?;
    if !out.status.success() {
        return None;
    }
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .find_map(|l| l.strip_prefix("password="))
        .map(str::to_owned)
        .filter(|v| !v.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_items_keep_what_the_widget_shows() {
        let body = json!({ "total_count": 1, "items": [{
            "title": "Fix it", "html_url": "https://github.com/a/b/pull/3",
            "repository_url": "https://api.github.com/repos/a/b", "number": 3,
            "pull_request": {}, "draft": true, "user": { "login": "me" },
            "comments": 2, "updated_at": "2026-09-27T10:00:00Z"
        }]});
        let out = items(&body);
        assert_eq!(out["total"], 1);
        assert_eq!(out["items"][0]["repo"], "a/b");
        assert_eq!(out["items"][0]["pr"], true);
        assert_eq!(out["items"][0]["draft"], true);
    }
}
