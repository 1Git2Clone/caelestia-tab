use std::collections::HashMap;
use std::io;
use std::sync::Mutex;

use serde_json::{Value, json};

use super::Plugin;

/// Song lyrics from LRCLIB (lrclib.net, free, no key), for a track a widget
/// asks about: `{ topic: "lyrics", command: "get", artist, title, album,
/// seconds }`. The value is the lyrics of the last track asked for, keyed so
/// a widget can tell they're for the song it shows: `{ key, plain, synced:
/// [{ ms, text }], none }`. Nothing is fetched until a widget asks, and each
/// track once per helper run.
pub struct Lyrics {
    state: Mutex<State>,
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

impl Plugin for Lyrics {
    fn topic(&self) -> &'static str {
        "lyrics"
    }

    fn command(&self, message: &Value) -> io::Result<()> {
        if message["command"] != "get" {
            return Err(io::Error::other(format!("unknown command {message}")));
        }
        self.state.lock().unwrap().wanted = Some(message.clone());
        Ok(())
    }

    fn read(&self) -> io::Result<Value> {
        let mut state = self.state.lock().unwrap();
        let Some(want) = state.wanted.clone() else {
            return Ok(Value::Null);
        };
        let s = |k: &str| want[k].as_str().unwrap_or_default().to_owned();
        let (artist, title) = (s("artist"), s("title"));
        if title.is_empty() {
            return Ok(Value::Null);
        }
        let key = key(&artist, &title);
        if let Some(hit) = state.cache.get(&key) {
            return Ok(hit.clone());
        }
        let value = match fetch(&artist, &title, &s("album"), want["seconds"].as_f64()) {
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
        state.cache.insert(key, value.clone());
        Ok(value)
    }
}

fn fetch(
    artist: &str,
    title: &str,
    album: &str,
    seconds: Option<f64>,
) -> io::Result<Option<Value>> {
    let mut request = ureq::get("https://lrclib.net/api/get")
        .query("artist_name", artist)
        .query("track_name", title)
        // LRCLIB asks clients to say who they are.
        .header(
            "User-Agent",
            "caelestia-tab (https://git.hu-tao.dev/hutao/caelestia-tab)",
        );
    if !album.is_empty() {
        request = request.query("album_name", album);
    }
    if let Some(s) = seconds.filter(|s| *s > 0.0) {
        request = request.query("duration", (s.round() as u64).to_string());
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
    match response.status().as_u16() {
        404 => Ok(None),
        200 => {
            let text = response
                .body_mut()
                .read_to_string()
                .map_err(io::Error::other)?;
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
