use std::collections::HashMap;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

use async_trait::async_trait;
use serde_json::{Value, json};

use super::github::client;
use super::{Plugin, home};

/// Song lyrics from LRCLIB (lrclib.net, free, no key), for a track a widget
/// asks about: `{ topic: "lyrics", command: "get", artist, title, album,
/// seconds }`. The value is the lyrics of the last track asked for, keyed so
/// a widget can tell they're for the song it shows: `{ key, plain, synced:
/// [{ ms, text }], none }`. Nothing is fetched until a widget asks, and each
/// track once: lyrics found are kept in `$XDG_CACHE_HOME/caelestia-tab/lyrics/`,
/// a file a track, across helper runs (a browser start is a new run). A
/// track LRCLIB has nothing for is remembered for this run only, so lyrics
/// added there later are found.
pub struct Lyrics {
    state: Mutex<State>,
    http: reqwest::Client,
    dir: PathBuf,
}

#[derive(Default)]
struct State {
    wanted: Option<Value>,
    cache: HashMap<String, Value>,
}

impl Lyrics {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(State::default()),
            http: client(),
            dir: std::env::var_os("XDG_CACHE_HOME")
                .filter(|d| !d.is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| home().join(".cache"))
                .join("caelestia-tab/lyrics"),
        }
    }
}

/// The track's identity: what a widget compares with the song it shows.
pub fn key(artist: &str, title: &str) -> String {
    format!(
        "{}\u{1f}{}",
        artist.trim().to_lowercase(),
        title.trim().to_lowercase()
    )
}

#[async_trait]
impl Plugin for Lyrics {
    fn topic(&self) -> &'static str {
        "lyrics"
    }

    async fn command(&self, message: &Value) -> io::Result<()> {
        if message["command"] != "get" {
            return Err(io::Error::other(format!("unknown command {message}")));
        }
        self.state.lock().unwrap().wanted = Some(message.clone());
        Ok(())
    }

    async fn read(&self) -> io::Result<Value> {
        let Some(want) = self.state.lock().unwrap().wanted.clone() else {
            return Ok(Value::Null);
        };
        let s = |k: &str| want[k].as_str().unwrap_or_default().to_owned();
        let (artist, title) = (s("artist"), s("title"));
        if title.is_empty() {
            return Ok(Value::Null);
        }
        let key = key(&artist, &title);
        if let Some(hit) = self.state.lock().unwrap().cache.get(&key) {
            return Ok(hit.clone());
        }
        let file = self.dir.join(format!("{:016x}.json", fnv(&key)));
        if let Ok(text) = tokio::fs::read_to_string(&file).await
            && let Ok(hit) = serde_json::from_str::<Value>(&text)
            && hit["key"] == key.as_str()
        {
            self.state.lock().unwrap().cache.insert(key, hit.clone());
            return Ok(hit);
        }
        let fetched = fetch(
            &self.http,
            &artist,
            &title,
            &s("album"),
            want["seconds"].as_f64(),
        )
        .await;
        let value = match fetched {
            Ok(Some(body)) => json!({
                "key": key,
                "plain": body["plainLyrics"],
                "synced": body["syncedLyrics"].as_str().map(synced).unwrap_or_default(),
                "none": body["instrumental"].as_bool().unwrap_or(false),
            }),
            Ok(None) => json!({ "key": key, "none": true }),
            // Not cached: the network may be back next time.
            Err(e) => return Ok(json!({ "key": key, "error": e.to_string() })),
        };
        if value["none"] != true {
            // A cache that can't be written is only a slower next time.
            let _ = tokio::fs::create_dir_all(&self.dir).await;
            if let Err(e) = tokio::fs::write(&file, value.to_string()).await {
                eprintln!("caelestia-tab: lyrics: {}: {e}", file.display());
            }
        }
        self.state.lock().unwrap().cache.insert(key, value.clone());
        Ok(value)
    }
}

/// FNV-1a, for a cache file's name: stable across builds, unlike std's hasher.
fn fnv(text: &str) -> u64 {
    text.bytes().fold(0xcbf29ce484222325, |h, b| {
        (h ^ b as u64).wrapping_mul(0x100000001b3)
    })
}

async fn fetch(
    http: &reqwest::Client,
    artist: &str,
    title: &str,
    album: &str,
    seconds: Option<f64>,
) -> io::Result<Option<Value>> {
    let mut request = http
        .get("https://lrclib.net/api/get")
        .query(&[("artist_name", artist), ("track_name", title)]);
    if !album.is_empty() {
        request = request.query(&[("album_name", album)]);
    }
    if let Some(s) = seconds.filter(|s| *s > 0.0) {
        request = request.query(&[("duration", (s.round() as u64).to_string())]);
    }
    let response = request.send().await.map_err(io::Error::other)?;
    match response.status().as_u16() {
        404 => Ok(None),
        200 => {
            let text = response.text().await.map_err(io::Error::other)?;
            Ok(Some(serde_json::from_str(&text)?))
        }
        status => Err(io::Error::other(format!("LRCLIB said {status}"))),
    }
}

/// LRC lines, `[mm:ss.xx] text`, as `{ ms, text }` in order. A line with
/// several stamps appears once for each.
fn synced(lrc: &str) -> Vec<Value> {
    let mut out: Vec<(u64, String)> = Vec::new();
    for line in lrc.lines() {
        let mut rest = line.trim();
        let mut stamps = Vec::new();
        while let Some(end) = rest.strip_prefix('[').and_then(|r| r.find(']')) {
            let stamp = &rest[1..=end];
            rest = &rest[end + 2..];
            let Some((m, s)) = stamp.split_once(':') else {
                break;
            };
            let (Ok(m), Ok(s)) = (m.parse::<u64>(), s.parse::<f64>()) else {
                break;
            };
            stamps.push(m * 60_000 + (s * 1000.0) as u64);
        }
        for ms in stamps {
            out.push((ms, rest.trim().to_owned()));
        }
    }
    out.sort_by_key(|(ms, _)| *ms);
    out.into_iter()
        .map(|(ms, text)| json!({ "ms": ms, "text": text }))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lrc_lines_become_times_in_order() {
        let lrc = "[00:12.50] second\n[00:01.00]first\n[01:02.00][00:30.00] twice\nno stamp";
        let out = synced(lrc);
        let times: Vec<u64> = out.iter().map(|l| l["ms"].as_u64().unwrap()).collect();
        assert_eq!(times, [1000, 12500, 30000, 62000]);
        assert_eq!(out[0]["text"], "first");
        assert_eq!(out[2]["text"], "twice");
    }

    #[test]
    fn keys_ignore_case_and_spaces() {
        assert_eq!(key(" Artist ", "Song"), key("artist", "song "));
    }
}
