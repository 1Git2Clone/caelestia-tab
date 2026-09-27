//! The native messaging side: sends every plugin's value on start, then again
//! whenever a watched file changes and the value differs from the last one sent.

use std::collections::HashMap;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc;

use notify::{RecursiveMode, Watcher};
use serde_json::json;

use crate::plugins::Plugin;

/// Browsers cap a message from the host at 1 MiB. Anything bigger (a
/// wallpaper, mostly) goes as parts the extension joins back together.
const PART: usize = 512 * 1024;

pub fn run(plugins: Vec<Box<dyn Plugin>>) -> io::Result<()> {
    // The browser closes stdin when the extension disconnects. Nothing is
    // expected from it yet, so this thread only drains it and exits with it.
    std::thread::spawn(|| {
        let _ = io::copy(&mut io::stdin().lock(), &mut io::sink());
        std::process::exit(0);
    });

    let (tx, rx) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx).map_err(io::Error::other)?;
    let mut dirs: Vec<&Path> = Vec::new();
    let watches: Vec<Vec<PathBuf>> = plugins.iter().map(|p| p.watches()).collect();
    for file in watches.iter().flatten() {
        let Some(dir) = file.parent() else { continue };
        if dirs.contains(&dir) {
            continue;
        }
        dirs.push(dir);
        if let Err(e) = watcher.watch(dir, RecursiveMode::NonRecursive) {
            eprintln!("caelestia-tab: can't watch {}: {e}", dir.display());
        }
    }

    let mut out = io::stdout().lock();
    let mut last: HashMap<&str, String> = HashMap::new();
    for plugin in &plugins {
        send_if_changed(plugin.as_ref(), &mut last, &mut out)?;
    }

    for event in rx {
        let Ok(event) = event else { continue };
        for (plugin, files) in plugins.iter().zip(&watches) {
            if event.paths.iter().any(|p| files.contains(p)) {
                send_if_changed(plugin.as_ref(), &mut last, &mut out)?;
            }
        }
    }
    Ok(())
}

fn send_if_changed<'a>(
    plugin: &'a dyn Plugin,
    last: &mut HashMap<&'a str, String>,
    out: &mut impl Write,
) -> io::Result<()> {
    let value = match plugin.read() {
        Ok(value) => value,
        Err(e) => {
            eprintln!("caelestia-tab: {}: {e}", plugin.topic());
            return Ok(());
        }
    };
    let body = json!({ "topic": plugin.topic(), "value": value }).to_string();
    if last.get(plugin.topic()) == Some(&body) {
        return Ok(());
    }
    for frame in frames(&body) {
        out.write_all(&frame)?;
    }
    out.flush()?;
    last.insert(plugin.topic(), body);
    Ok(())
}

/// Length-prefixed frames for one message: the message itself when it fits,
/// or `{"part", "parts", "data"}` pieces whose `data` concatenates back into it.
fn frames(body: &str) -> Vec<Vec<u8>> {
    let pieces: Vec<String> = if body.len() <= PART {
        vec![body.to_owned()]
    } else {
        let mut chunks = Vec::new();
        let mut rest = body;
        while !rest.is_empty() {
            let mut at = PART.min(rest.len());
            while !rest.is_char_boundary(at) {
                at -= 1;
            }
            chunks.push(&rest[..at]);
            rest = &rest[at..];
        }
        let parts = chunks.len();
        chunks
            .into_iter()
            .enumerate()
            .map(|(part, data)| json!({ "part": part, "parts": parts, "data": data }).to_string())
            .collect()
    };
    pieces
        .into_iter()
        .map(|piece| {
            let mut frame = (piece.len() as u32).to_ne_bytes().to_vec();
            frame.extend_from_slice(piece.as_bytes());
            frame
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::io::Read;

    /// Reads one frame, the way the browser would.
    fn read_frame(input: &mut impl Read) -> io::Result<Value> {
        let mut len = [0; 4];
        input.read_exact(&mut len)?;
        let mut body = vec![0; u32::from_ne_bytes(len) as usize];
        input.read_exact(&mut body)?;
        Ok(serde_json::from_slice(&body)?)
    }

    #[test]
    fn big_messages_split_and_rejoin() {
        let small = json!({ "topic": "scheme", "value": "é" }).to_string();
        let frames_small = frames(&small);
        assert_eq!(frames_small.len(), 1);
        assert_eq!(read_frame(&mut &frames_small[0][..]).unwrap()["value"], "é");

        // Multi-byte characters straddling a part boundary must not be cut.
        let big = json!({ "topic": "wallpaper", "value": "ä".repeat(PART) }).to_string();
        let mut joined = String::new();
        let all = frames(&big);
        assert!(all.len() > 1);
        for frame in &all {
            assert!(frame.len() - 4 <= 1024 * 1024);
            let part = read_frame(&mut &frame[..]).unwrap();
            assert_eq!(part["parts"], all.len());
            joined.push_str(part["data"].as_str().unwrap());
        }
        assert_eq!(joined, big);
    }
}
