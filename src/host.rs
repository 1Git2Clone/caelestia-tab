//! The native messaging side: sends every plugin's value on start, then again
//! whenever it may have changed (a watched file, the plugin's own timer or
//! signal, or a command from the extension) and differs from the last one sent.

use std::collections::HashMap;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use notify::{RecursiveMode, Watcher};
use serde_json::{Value, json};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::sync::mpsc;

use crate::plugins::Plugin;

/// Browsers cap a message from the host at 1 MiB. Anything bigger (a
/// wallpaper, mostly) goes as parts the extension joins back together.
const PART: usize = 512 * 1024;

/// What a plugin's task is asked to do: run a command from the extension
/// and read, or just read.
type Job = Option<Value>;

/// Handed to [`Plugin::start`]: asks for the plugin to be read again.
#[derive(Clone)]
pub struct Wake(mpsc::UnboundedSender<Job>);

impl Wake {
    /// False once the host has stopped, when whatever called it can stop too.
    pub fn refresh(&self) -> bool {
        self.0.send(None).is_ok()
    }
}

pub async fn run(plugins: Vec<Box<dyn Plugin>>) -> io::Result<()> {
    let plugins: Vec<Arc<dyn Plugin>> = plugins.into_iter().map(Arc::from).collect();
    let (values, mut read) = mpsc::unbounded_channel::<(usize, io::Result<Value>)>();

    // A task per plugin, so a slow one (GitHub's searches, a lyrics lookup)
    // holds up only itself: a media command never waits behind a request.
    let jobs: Vec<mpsc::UnboundedSender<Job>> = plugins
        .iter()
        .enumerate()
        .map(|(i, plugin)| {
            let (tx, rx) = mpsc::unbounded_channel();
            tokio::spawn(serve(plugin.clone(), i, rx, values.clone()));
            plugin.start(Wake(tx.clone()));
            let _ = tx.send(None);
            tx
        })
        .collect();

    // The extension's messages, framed like ours. The browser closes stdin
    // when the extension disconnects, and the helper exits with it.
    let topics: HashMap<&str, mpsc::UnboundedSender<Job>> = plugins
        .iter()
        .map(|p| p.topic())
        .zip(jobs.iter().cloned())
        .collect();
    tokio::spawn(async move {
        let mut input = tokio::io::stdin();
        while let Ok(message) = read_frame(&mut input).await {
            let topic = message["topic"].as_str().unwrap_or_default();
            match topics.get(topic) {
                Some(tx) => {
                    let _ = tx.send(Some(message));
                }
                None => eprintln!("caelestia-tab: a command for no plugin: {message}"),
            }
        }
        std::process::exit(0);
    });

    let watches: Vec<Vec<PathBuf>> = plugins.iter().map(|p| p.watches()).collect();
    let dirs: Vec<PathBuf> = {
        let mut dirs: Vec<&Path> = watches
            .iter()
            .flatten()
            .filter_map(|f| f.parent())
            .collect();
        dirs.sort();
        dirs.dedup();
        dirs.into_iter().map(Path::to_owned).collect()
    };
    let wake = jobs.clone();
    let mut watcher = notify::recommended_watcher(move |e: notify::Result<notify::Event>| {
        let Ok(event) = e else { return };
        // Reading a file raises an access event too: reacting to it would read
        // the file again, forever, and bury every other value behind the flood.
        if let notify::EventKind::Access(_) = event.kind {
            return;
        }
        for (tx, files) in wake.iter().zip(&watches) {
            if event.paths.iter().any(|p| files.contains(p)) {
                let _ = tx.send(None);
            }
        }
    })
    .map_err(io::Error::other)?;
    for dir in &dirs {
        if let Err(e) = watcher.watch(dir, RecursiveMode::NonRecursive) {
            eprintln!("caelestia-tab: can't watch {}: {e}", dir.display());
        }
    }

    let mut out = tokio::io::stdout();
    let mut last: HashMap<&str, String> = HashMap::new();
    while let Some((i, value)) = read.recv().await {
        send_if_changed(plugins[i].as_ref(), value, &mut last, &mut out).await?;
    }
    Ok(())
}

/// One plugin's jobs, in order. Jobs that pile up while it's busy are run
/// and answered with a single read.
async fn serve(
    plugin: Arc<dyn Plugin>,
    i: usize,
    mut jobs: mpsc::UnboundedReceiver<Job>,
    values: mpsc::UnboundedSender<(usize, io::Result<Value>)>,
) {
    while let Some(first) = jobs.recv().await {
        let mut next = Some(first);
        while let Some(job) = next {
            if let Some(message) = job
                && let Err(e) = plugin.command(&message).await
            {
                eprintln!("caelestia-tab: {}: {e}", plugin.topic());
            }
            next = jobs.try_recv().ok();
        }
        if values.send((i, plugin.read().await)).is_err() {
            break;
        }
    }
}

/// One length-prefixed JSON message, as the browser sends and we send.
async fn read_frame(input: &mut (impl AsyncRead + Unpin)) -> io::Result<Value> {
    let mut len = [0; 4];
    input.read_exact(&mut len).await?;
    let mut body = vec![0; u32::from_ne_bytes(len) as usize];
    input.read_exact(&mut body).await?;
    Ok(serde_json::from_slice(&body)?)
}

async fn send_if_changed(
    plugin: &dyn Plugin,
    value: io::Result<Value>,
    last: &mut HashMap<&'static str, String>,
    out: &mut (impl AsyncWrite + Unpin),
) -> io::Result<()> {
    let value = match value {
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
        out.write_all(&frame).await?;
    }
    out.flush().await?;
    plugin.changed(&value);
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

    #[tokio::test]
    async fn big_messages_split_and_rejoin() {
        let small = json!({ "topic": "scheme", "value": "é" }).to_string();
        let frames_small = frames(&small);
        assert_eq!(frames_small.len(), 1);
        assert_eq!(
            read_frame(&mut &frames_small[0][..]).await.unwrap()["value"],
            "é"
        );

        // Multi-byte characters straddling a part boundary must not be cut.
        let big = json!({ "topic": "wallpaper", "value": "ä".repeat(PART) }).to_string();
        let mut joined = String::new();
        let all = frames(&big);
        assert!(all.len() > 1);
        for frame in &all {
            assert!(frame.len() - 4 <= 1024 * 1024);
            let part = read_frame(&mut &frame[..]).await.unwrap();
            assert_eq!(part["parts"], all.len());
            joined.push_str(part["data"].as_str().unwrap());
        }
        assert_eq!(joined, big);
    }
}
