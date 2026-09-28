use std::collections::{BTreeSet, HashMap};
use std::io;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use futures_util::future::join_all;
use serde_json::{Value, json};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use super::Plugin;
use crate::host::Wake;
use crate::secrets;

/// How often everything is fetched again, unasked. GitHub allows 30 searches
/// a minute; a tab opening, or switching to GitHub, answers from what was
/// last fetched rather than searching again.
/// ponytail: fixed; a setting when someone wants it fresher or rarer.
const EVERY: Duration = Duration::from_secs(5 * 60);
/// How long a search nothing asks for is kept: the private toggle swaps
/// every search for its `is:public` twin, and flipping it back and forth
/// shouldn't search again (GitHub allows 30 a minute).
/// ponytail: fixed; longer if someone flips it less often than hourly.
const KEEP: Duration = Duration::from_secs(60 * 60);

/// Whether something fetched then is due again.
fn old(t: &Instant) -> bool {
    t.elapsed() >= EVERY - Duration::from_secs(5)
}

/// Your events, private repositories' included (for your own token), and
/// public ones only: GitHub's two lists of them, each fetched and cached on
/// its own, so a tab flipping between them doesn't ask again.
const ALL: &str = "events";
const PUBLIC: &str = "events/public";

/// GitHub for the new tab's GitHub tab: your searches, and your recent
/// activity. The tab sends what it shows (`{ topic: "github", command:
/// "queries", widget, queries, activity, private }`, replacing that widget's last
/// list); this fetches it every five minutes, on `{ command: "refresh" }`,
/// and when a search is new, and otherwise answers from what it has. Each
/// search keeps its ETag, so an unchanged one is a 304. Rate-limited, it
/// keeps what it had and waits for GitHub's reset. The token is the first of:
///
/// 1. the `github` secret alias (see `secrets.rs`)
/// 2. `GH_TOKEN` or `GITHUB_TOKEN`
/// 3. `gh auth token`
/// 4. git's credential helper for github.com, with prompts off
///
/// The token stays here. The value is only the results.
pub struct GitHub {
    state: Mutex<State>,
    http: reqwest::Client,
}

#[derive(Default)]
struct State {
    // widget id -> its queries, and which of your events it shows, if any.
    queries: HashMap<String, Vec<String>>,
    activity: HashMap<String, Option<&'static str>>,
    // query -> (ETag, the last result, when it was last fetched).
    cache: HashMap<String, (String, Value, Instant)>,
    // Your login, and each list of your events with its ETag and when it
    // was last fetched.
    login: Option<String>,
    events: HashMap<&'static str, (String, Value, Instant)>,
    token: Option<(String, &'static str)>,
    // When everything was last fetched, and when (ms) for the value.
    fetched: Option<Instant>,
    at: Option<u64>,
    // Asked to fetch everything now.
    forced: bool,
    // Rate-limited until then (ms), and what GitHub said.
    limited: Option<(u64, String)>,
    error: Option<String>,
}

impl GitHub {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(State::default()),
            http: client(),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// What a failed request says: GitHub's message, its first sentence only,
/// and when a rate limit ends, if it's one.
struct Failure {
    message: String,
    until: Option<u64>,
    unauthorised: bool,
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
                state.queries.insert(widget.clone(), queries);
                // A tab from before `private` sends none: it gets them all.
                let private = message["private"].as_bool().unwrap_or(true);
                let events = message["activity"]
                    .as_bool()
                    .unwrap_or(false)
                    .then_some(if private { ALL } else { PUBLIC });
                state.activity.insert(widget, events);
            }
            // Drop the cached token too: the user may have just logged in.
            Some("refresh") => {
                state.token = None;
                state.forced = true;
            }
            _ => return Err(io::Error::other(format!("unknown command {message}"))),
        }
        Ok(())
    }

    async fn read(&self) -> io::Result<Value> {
        // What to fetch, taken out so the lock isn't held across requests.
        let (due, kinds, cached, events, login, known) = {
            let mut state = self.state.lock().unwrap();
            let queries: BTreeSet<String> = state.queries.values().flatten().cloned().collect();
            // Results for searches nothing asks for any more are dropped,
            // after a while.
            state
                .cache
                .retain(|q, (_, _, t)| queries.contains(q) || t.elapsed() < KEEP);
            let limited = state
                .limited
                .as_ref()
                .is_some_and(|(until, _)| now_ms() < *until);
            let stale = state.forced || state.fetched.as_ref().is_none_or(old);
            // Everything when it's time; else only what has no result, or
            // an old one (a search kept from before the toggle flipped).
            let due: Vec<String> = if limited {
                Vec::new()
            } else if stale {
                queries.iter().cloned().collect()
            } else {
                queries
                    .iter()
                    .filter(|q| state.cache.get(*q).is_none_or(|(_, _, t)| old(t)))
                    .cloned()
                    .collect()
            };
            // Each list of events asked for, when it's time for it.
            let wanted: BTreeSet<&'static str> =
                state.activity.values().flatten().copied().collect();
            let kinds: Vec<&'static str> = wanted
                .into_iter()
                .filter(|k| {
                    !limited && (stale || state.events.get(k).is_none_or(|(_, _, t)| old(t)))
                })
                .collect();
            if stale && !limited {
                state.forced = false;
            }
            (
                due,
                kinds,
                state.cache.clone(),
                state.events.clone(),
                state.login.clone(),
                state.token.clone(),
            )
        };
        if !due.is_empty() || !kinds.is_empty() {
            let token = match known {
                Some(t) => Some(t),
                None => token().await,
            };
            let Some((token, from)) = token else {
                self.state.lock().unwrap().error = Some("No GitHub token. Log in with `gh auth login`, set GH_TOKEN, or add a `github` secret (see the handbook's GitHub chapter).".into());
                return Ok(self.value());
            };
            let searches = join_all(due.iter().map(|q| {
                let etag = cached.get(q).map(|(etag, _, _)| etag.as_str());
                search(&self.http, &token, q, etag)
            }));
            let mine = async {
                if kinds.is_empty() {
                    return None;
                }
                Some(activity_of(&self.http, &token, login.as_deref(), &kinds, &events).await)
            };
            let (answers, mine) = futures_util::join!(searches, mine);

            let mut state = self.state.lock().unwrap();
            state.token = Some((token, from));
            state.error = None;
            let mut failed: Option<Failure> = None;
            for (q, answer) in due.into_iter().zip(answers) {
                match answer {
                    Ok(Some((etag, value))) => {
                        state.cache.insert(q, (etag, value, Instant::now()));
                    }
                    // A 304: the same result, fetched now.
                    Ok(None) => {
                        if let Some(c) = state.cache.get_mut(&q) {
                            c.2 = Instant::now();
                        }
                    }
                    Err(f) => failed = Some(f),
                }
            }
            match mine {
                Some(Ok((login, lists))) => {
                    state.login = Some(login);
                    for (kind, fresh) in lists {
                        match fresh {
                            Some((etag, value)) => {
                                state.events.insert(kind, (etag, value, Instant::now()));
                            }
                            // A 304: the same list, fetched now.
                            None => {
                                if let Some(e) = state.events.get_mut(kind) {
                                    e.2 = Instant::now();
                                }
                            }
                        }
                    }
                }
                Some(Err(f)) => failed = Some(f),
                None => {}
            }
            match failed {
                Some(f) => {
                    if f.unauthorised {
                        state.token = None;
                    }
                    match f.until {
                        Some(until) => state.limited = Some((until, f.message)),
                        None => state.error = Some(f.message),
                    }
                }
                None => {
                    state.limited = None;
                    state.fetched = Some(Instant::now());
                    state.at = Some(now_ms());
                }
            }
        }
        Ok(self.value())
    }
}

impl GitHub {
    /// What the tab gets: the last results of each search kept (the ones
    /// it shows, and their twins from before the toggle flipped, so flipping
    /// back shows them at once), your activity, when they were fetched, and
    /// what went wrong, if anything.
    fn value(&self) -> Value {
        let state = self.state.lock().unwrap();
        let results: serde_json::Map<String, Value> = state
            .cache
            .iter()
            .map(|(q, (_, v, _))| (q.clone(), v.clone()))
            .collect();
        let limited = state
            .limited
            .as_ref()
            .filter(|(until, _)| now_ms() < *until);
        json!({
            "results": results,
            "activity": state.events.get(ALL).map(|(_, v, _)| v.clone()),
            "publicActivity": state.events.get(PUBLIC).map(|(_, v, _)| v.clone()),
            "at": state.at,
            "auth": state.token.as_ref().map(|(_, from)| *from),
            "error": limited.map(|(_, m)| m.clone()).or_else(|| state.error.clone()),
            "limitedUntil": limited.map(|(until, _)| *until),
        })
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

/// A GET to GitHub's API: the body, and its ETag, or None for a 304.
async fn get(
    http: &reqwest::Client,
    token: &str,
    url: &str,
    query: &[(&str, &str)],
    etag: Option<&str>,
) -> Result<Option<(String, Value)>, Failure> {
    let mut request = http
        .get(url)
        .query(query)
        .bearer_auth(token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28");
    if let Some(etag) = etag {
        request = request.header("If-None-Match", etag);
    }
    let failure = |message: String| Failure {
        message,
        until: None,
        unauthorised: false,
    };
    let response = request.send().await.map_err(|e| failure(e.to_string()))?;
    let status = response.status().as_u16();
    if status == 304 {
        return Ok(None);
    }
    let header = |name: &str| {
        response
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned)
    };
    let etag = header("etag").unwrap_or_default();
    // A rate limit's end: the reset time, or a Retry-After, or a minute.
    let reset = header("x-ratelimit-reset").and_then(|v| v.parse::<u64>().ok());
    let retry = header("retry-after").and_then(|v| v.parse::<u64>().ok());
    let remaining = header("x-ratelimit-remaining");
    let text = response.text().await.map_err(|e| failure(e.to_string()))?;
    let body: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    if status == 200 {
        return Ok(Some((etag, body)));
    }
    let said = body["message"].as_str().unwrap_or("request failed");
    let limited = status == 429
        || (status == 403 && (remaining.as_deref() == Some("0") || said.contains("rate limit")));
    Err(Failure {
        message: format!("GitHub said {status}: {}", first_sentence(said)),
        until: limited.then(|| {
            retry
                .map(|s| now_ms() + s * 1000)
                .or(reset.map(|s| s * 1000))
                .unwrap_or(now_ms() + 60_000)
        }),
        unauthorised: status == 401,
    })
}

/// "API rate limit exceeded for user ID 1. If you reach out …" is
/// "API rate limit exceeded".
fn first_sentence(message: &str) -> &str {
    let end = message.find(". ").unwrap_or(message.len());
    let sentence = message[..end].trim_end_matches('.');
    sentence.split(" for user ID").next().unwrap_or(sentence)
}

/// One search, or None when it hasn't changed since `etag`.
async fn search(
    http: &reqwest::Client,
    token: &str,
    q: &str,
    etag: Option<&str>,
) -> Result<Option<(String, Value)>, Failure> {
    let answer = get(
        http,
        token,
        "https://api.github.com/search/issues",
        &[("q", q), ("sort", "updated"), ("per_page", "20")],
        etag,
    )
    .await?;
    Ok(answer.map(|(etag, body)| (etag, items(&body))))
}

/// Your login (asked once) and each list of your recent events asked for,
/// None for one that hasn't changed since its ETag. These are GitHub's core
/// API, not search, whose limit is its own (5000 an hour); a 304 isn't
/// counted against it.
async fn activity_of(
    http: &reqwest::Client,
    token: &str,
    login: Option<&str>,
    kinds: &[&'static str],
    cached: &HashMap<&'static str, (String, Value, Instant)>,
) -> Result<(String, Vec<(&'static str, Option<(String, Value)>)>), Failure> {
    let login = match login {
        Some(l) => l.to_owned(),
        None => get(http, token, "https://api.github.com/user", &[], None)
            .await?
            .and_then(|(_, me)| me["login"].as_str().map(str::to_owned))
            .unwrap_or_default(),
    };
    let answers = join_all(kinds.iter().map(|kind| {
        let url = format!("https://api.github.com/users/{login}/{kind}");
        let etag = cached.get(kind).map(|(etag, _, _)| etag.as_str());
        async move { get(http, token, &url, &[("per_page", "30")], etag).await }
    }))
    .await;
    let mut lists = Vec::new();
    for (kind, answer) in kinds.iter().zip(answers) {
        lists.push((*kind, answer?.map(|(etag, body)| (etag, events(&body)))));
    }
    Ok((login, lists))
}

/// Your events as the tab shows them: what happened, where, when, and a link.
fn events(body: &Value) -> Value {
    let list: Vec<Value> = body
        .as_array()
        .into_iter()
        .flatten()
        .map(|e| {
            let repo = e["repo"]["name"].as_str().unwrap_or_default();
            let p = &e["payload"];
            let number = p["pull_request"]["number"]
                .as_u64()
                .or(p["issue"]["number"].as_u64())
                .or(p["number"].as_u64());
            let title = p["pull_request"]["title"]
                .as_str()
                .or(p["issue"]["title"].as_str())
                .unwrap_or_default();
            let about = |what: &str| match (number, title) {
                (Some(n), "") => format!("{what} #{n}"),
                (Some(n), t) => format!("{what} #{n}: {t}"),
                (None, _) => what.to_owned(),
            };
            let action = capitalised(p["action"].as_str().unwrap_or(""));
            let branch = p["ref"].as_str().unwrap_or_default().trim_start_matches("refs/heads/");
            let (text, url) = match e["type"].as_str().unwrap_or_default() {
                // GitHub's push events carry `head` (and `before`), no longer
                // `size` or `commits`: the commit pushed is what's known.
                "PushEvent" => match p["head"].as_str() {
                    Some(head) => (
                        format!("Pushed {} to {branch}", &head[..head.len().min(7)]),
                        format!("https://github.com/{repo}/commit/{head}"),
                    ),
                    None => (format!("Pushed to {branch}"), format!("https://github.com/{repo}/commits/{branch}")),
                },
                "PullRequestEvent" => (about(&format!("{action} pull request")), link(&p["pull_request"]["html_url"], repo)),
                "IssuesEvent" => (about(&format!("{action} issue")), link(&p["issue"]["html_url"], repo)),
                "IssueCommentEvent" => (about("Commented on"), link(&p["comment"]["html_url"], repo)),
                "PullRequestReviewEvent" => (about("Reviewed"), link(&p["review"]["html_url"], repo)),
                "PullRequestReviewCommentEvent" => (about("Commented on the review of"), link(&p["comment"]["html_url"], repo)),
                "CreateEvent" => (
                    match p["ref_type"].as_str() {
                        Some("repository") | None => "Created the repository".to_owned(),
                        Some(kind) => format!("Created {kind} {}", p["ref"].as_str().unwrap_or_default()),
                    },
                    format!("https://github.com/{repo}"),
                ),
                "DeleteEvent" => (
                    format!("Deleted {} {}", p["ref_type"].as_str().unwrap_or("branch"), p["ref"].as_str().unwrap_or_default()),
                    format!("https://github.com/{repo}"),
                ),
                "WatchEvent" => ("Starred it".to_owned(), format!("https://github.com/{repo}")),
                "ForkEvent" => (
                    format!("Forked it to {}", p["forkee"]["full_name"].as_str().unwrap_or_default()),
                    link(&p["forkee"]["html_url"], repo),
                ),
                "ReleaseEvent" => (
                    format!("{action} release {}", p["release"]["name"].as_str().or(p["release"]["tag_name"].as_str()).unwrap_or_default()),
                    link(&p["release"]["html_url"], repo),
                ),
                "PublicEvent" => ("Made it public".to_owned(), format!("https://github.com/{repo}")),
                other => (other.trim_end_matches("Event").to_owned(), format!("https://github.com/{repo}")),
            };
            json!({ "kind": e["type"], "repo": repo, "text": text, "url": url, "at": e["created_at"] })
        })
        .collect();
    Value::Array(list)
}

fn link(url: &Value, repo: &str) -> String {
    url.as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| format!("https://github.com/{repo}"))
}

fn capitalised(word: &str) -> String {
    let mut chars = word.chars();
    chars
        .next()
        .map(|c| c.to_uppercase().chain(chars).collect())
        .unwrap_or_default()
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

    #[test]
    fn events_say_what_happened_and_link_to_it() {
        let body = json!([
            { "type": "PushEvent", "repo": { "name": "a/b" }, "created_at": "t",
              "payload": { "ref": "refs/heads/main", "head": "16bdf70a055fcb73fb5a120822ce9c66029b11e7", "before": "63abe44" } },
            { "type": "PullRequestEvent", "repo": { "name": "a/b" }, "created_at": "t",
              "payload": { "action": "opened", "number": 3,
                "pull_request": { "number": 3, "title": "Fix it", "html_url": "https://github.com/a/b/pull/3" } } },
            { "type": "GollumEvent", "repo": { "name": "a/b" }, "created_at": "t", "payload": {} },
        ]);
        let out = events(&body);
        assert_eq!(out[0]["text"], "Pushed 16bdf70 to main");
        assert_eq!(
            out[0]["url"],
            "https://github.com/a/b/commit/16bdf70a055fcb73fb5a120822ce9c66029b11e7"
        );
        assert_eq!(out[1]["text"], "Opened pull request #3: Fix it");
        assert_eq!(out[1]["url"], "https://github.com/a/b/pull/3");
        assert_eq!(out[2]["text"], "Gollum");
    }

    #[test]
    fn a_rate_limit_message_is_its_first_sentence() {
        let said = "API rate limit exceeded for user ID 171241044. If you reach out to GitHub Support for help, please include the request ID C93C.";
        assert_eq!(first_sentence(said), "API rate limit exceeded");
        assert_eq!(first_sentence("Bad credentials"), "Bad credentials");
    }
}
