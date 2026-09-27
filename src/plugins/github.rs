use std::collections::{BTreeSet, HashMap};
use std::io::{self, Write};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use serde_json::{Value, json};

use super::Plugin;
use crate::host::{Event, Wake};
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
        }
    }
}

impl Plugin for GitHub {
    fn topic(&self) -> &'static str {
        "github"
    }

    fn start(&self, wake: Wake) {
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(EVERY);
                if wake.send(Event::Refresh("github")).is_err() {
                    break;
                }
            }
        });
    }

    fn command(&self, message: &Value) -> io::Result<()> {
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

    fn read(&self) -> io::Result<Value> {
        let mut state = self.state.lock().unwrap();
        if state.queries.values().all(Vec::is_empty) {
            return Ok(json!({ "results": {} }));
        }
        if state.token.is_none() {
            state.token = token();
        }
        let Some((token, from)) = state.token.clone() else {
            return Ok(json!({
                "results": {},
                "error": "No GitHub token. Log in with `gh auth login`, set GH_TOKEN, or add a `github` secret (see the handbook's GitHub chapter).",
            }));
        };
        let mut results = serde_json::Map::new();
        let queries: BTreeSet<String> = state.queries.values().flatten().cloned().collect();
        // Results for searches no widget asks for any more are dropped.
        state.cache.retain(|q, _| queries.contains(q));
        for q in queries {
            let cached = state.cache.get(&q).cloned();
            match search(&token, &q, cached.as_ref().map(|(etag, _)| etag.as_str())) {
                Ok(Some((etag, value))) => {
                    state.cache.insert(q.clone(), (etag, value.clone()));
                    results.insert(q, value);
                }
                Ok(None) => {
                    results.insert(q, cached.map(|(_, v)| v).unwrap_or(Value::Null));
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

/// One search, or None when it hasn't changed since `etag`.
fn search(token: &str, q: &str, etag: Option<&str>) -> io::Result<Option<(String, Value)>> {
    let mut request = ureq::get("https://api.github.com/search/issues")
        .query("q", q)
        .query("sort", "updated")
        .query("per_page", "20")
        .header("Authorization", &format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", "caelestia-tab");
    if let Some(etag) = etag {
        request = request.header("If-None-Match", etag);
    }
    let mut response = request
        .config()
        .http_status_as_error(false)
        // The host reads plugins one at a time, so a request that hangs
        // would hold up every other plugin.
        .timeout_global(Some(std::time::Duration::from_secs(10)))
        .build()
        .call()
        .map_err(io::Error::other)?;
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
    let text = response
        .body_mut()
        .read_to_string()
        .map_err(io::Error::other)?;
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
fn token() -> Option<(String, &'static str)> {
    let found = |v: String| Some(v.trim().to_owned()).filter(|v| !v.is_empty());
    if let Ok(Some(v)) = secrets::get("github") {
        return found(v).map(|v| (v, "secret"));
    }
    for var in ["GH_TOKEN", "GITHUB_TOKEN"] {
        if let Some(v) = std::env::var(var).ok().and_then(found) {
            return Some((v, "env"));
        }
    }
    if let Ok(out) = Command::new("gh").args(["auth", "token"]).output()
        && out.status.success()
        && let Some(v) = found(String::from_utf8_lossy(&out.stdout).into_owned())
    {
        return Some((v, "gh"));
    }
    git_credential().map(|v| (v, "git"))
}

/// git's stored credential for github.com. Prompts are off, so a helper that
/// would ask (a terminal prompt, Git Credential Manager's window) answers
/// nothing instead of popping up.
fn git_credential() -> Option<String> {
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
    child
        .stdin
        .take()?
        .write_all(b"protocol=https\nhost=github.com\n\n")
        .ok()?;
    let out = child.wait_with_output().ok()?;
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
