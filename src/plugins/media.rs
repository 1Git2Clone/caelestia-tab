use std::collections::HashMap;
use std::io;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde_json::{Value, json};
use zbus::MatchRule;
use zbus::blocking::{Connection, MessageIterator, Proxy, fdo::DBusProxy};
use zbus::message::Type as MessageType;
use zbus::zvariant::OwnedValue;

use super::Plugin;
use crate::host::{Event, Wake};

const PREFIX: &str = "org.mpris.MediaPlayer2.";
const PATH: &str = "/org/mpris/MediaPlayer2";
const PLAYER: &str = "org.mpris.MediaPlayer2.Player";

/// Every MPRIS media player on the session bus (Spotify, mpv, a browser …):
/// what's playing, and play, pause, next, previous and seek from the new tab.
/// Read again whenever a player's properties change or a player comes or
/// goes. MPRIS doesn't signal the position as it moves, so each player's
/// value carries the position with the time it was read (`at`) and the rate,
/// and the widget moves it on from there.
pub struct Media;

impl Plugin for Media {
    fn topic(&self) -> &'static str {
        "media"
    }

    fn start(&self, wake: Wake) {
        std::thread::spawn(move || {
            if let Err(e) = listen(&wake) {
                eprintln!("caelestia-tab: media: {e}");
            }
        });
    }

    fn command(&self, message: &Value) -> io::Result<()> {
        let player = message["player"].as_str().unwrap_or_default();
        if !player.starts_with(PREFIX) {
            return Err(io::Error::other("not an MPRIS player"));
        }
        let conn = Connection::session().map_err(io::Error::other)?;
        let proxy = Proxy::new(&conn, player, PATH, PLAYER).map_err(io::Error::other)?;
        // Only these: the extension names a player method, and nothing else
        // on the bus is reachable through here.
        match message["command"].as_str() {
            Some(m @ ("PlayPause" | "Play" | "Pause" | "Next" | "Previous")) => {
                proxy.call_method(m, &()).map(drop)
            }
            Some("SetPosition") => {
                let track =
                    zbus::zvariant::ObjectPath::try_from(message["track"].as_str().unwrap_or("/"))
                        .map_err(io::Error::other)?;
                let position = message["position"].as_i64().unwrap_or(0);
                proxy
                    .call_method("SetPosition", &(track, position))
                    .map(drop)
            }
            _ => return Err(io::Error::other(format!("unknown command {message}"))),
        }
        .map_err(io::Error::other)
    }

    fn read(&self) -> io::Result<Value> {
        let conn = Connection::session().map_err(io::Error::other)?;
        let names = DBusProxy::new(&conn)
            .map_err(io::Error::other)?
            .list_names()
            .map_err(io::Error::other)?;
        let players: Vec<Value> = names
            .iter()
            .map(|n| n.as_str())
            // playerctld stands in for whichever player is active; every
            // player it stands for is listed under its own name anyway.
            .filter(|n| n.starts_with(PREFIX) && *n != "org.mpris.MediaPlayer2.playerctld")
            .filter_map(|name| player(&conn, name).ok())
            .collect();
        Ok(json!({ "players": players }))
    }
}

/// Wakes the host on every change to a player: its properties, a seek, or a
/// player appearing or quitting.
fn listen(wake: &Wake) -> zbus::Result<()> {
    let conn = Connection::session()?;
    let rules = [
        MatchRule::builder()
            .msg_type(MessageType::Signal)
            .interface("org.freedesktop.DBus.Properties")?
            .member("PropertiesChanged")?
            .path(PATH)?
            .build(),
        MatchRule::builder()
            .msg_type(MessageType::Signal)
            .interface(PLAYER)?
            .member("Seeked")?
            .build(),
        MatchRule::builder()
            .msg_type(MessageType::Signal)
            .interface("org.freedesktop.DBus")?
            .member("NameOwnerChanged")?
            .arg0ns(PREFIX.trim_end_matches('.'))?
            .build(),
    ];
    let (tx, rx) = std::sync::mpsc::channel::<()>();
    for rule in rules {
        let conn = conn.clone();
        let tx = tx.clone();
        std::thread::spawn(move || {
            let Ok(messages) = MessageIterator::for_match_rule(rule, &conn, None) else {
                return;
            };
            for _ in messages {
                if tx.send(()).is_err() {
                    break;
                }
            }
        });
    }
    for () in rx {
        if wake.send(Event::Refresh("media")).is_err() {
            break;
        }
    }
    Ok(())
}

fn player(conn: &Connection, name: &str) -> zbus::Result<Value> {
    let p = Proxy::new(conn, name, PATH, PLAYER)?;
    let root = Proxy::new(conn, name, PATH, "org.mpris.MediaPlayer2")?;
    let meta: HashMap<String, OwnedValue> = p.get_property("Metadata").unwrap_or_default();
    let text = |k: &str| meta.get(k).and_then(|v| String::try_from(v.clone()).ok());
    let list = |k: &str| {
        meta.get(k)
            .and_then(|v| Vec::<String>::try_from(v.clone()).ok())
            .unwrap_or_default()
    };
    let length = meta.get("mpris:length").and_then(|v| {
        i64::try_from(v.clone())
            .ok()
            .or_else(|| u64::try_from(v.clone()).ok().map(|n| n as i64))
    });
    let track = meta
        .get("mpris:trackid")
        .and_then(|v| zbus::zvariant::OwnedObjectPath::try_from(v.clone()).ok())
        .map(|p| p.to_string());
    let can = |k: &str| p.get_property::<bool>(k).unwrap_or(false);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(json!({
        "player": name,
        "identity": root.get_property::<String>("Identity").unwrap_or_else(|_| name.trim_start_matches(PREFIX).to_owned()),
        "status": p.get_property::<String>("PlaybackStatus").unwrap_or_default(),
        "title": text("xesam:title"),
        "artist": list("xesam:artist").join(", "),
        "album": text("xesam:album"),
        // xesam:contentCreated is a date; the year is what's shown.
        "year": text("xesam:contentCreated").and_then(|d| d.get(..4).map(str::to_owned)),
        // Some players send the lyrics themselves.
        "lyrics": text("xesam:asText"),
        "art": text("mpris:artUrl").map(|u| art(&u)),
        "track": track,
        "length": length,
        "position": p.get_property::<i64>("Position").ok(),
        "rate": p.get_property::<f64>("Rate").unwrap_or(1.0),
        "at": now,
        "canNext": can("CanGoNext"),
        "canPrevious": can("CanGoPrevious"),
        "canPlay": can("CanPlay"),
        "canPause": can("CanPause"),
        "canSeek": can("CanSeek"),
    }))
}

/// Cover art the new tab can show: an https URL as it is, a local file as a
/// data: URL, since an extension page can't load file://.
fn art(url: &str) -> String {
    let Some(path) = url.strip_prefix("file://") else {
        return url.to_owned();
    };
    let path = path.replace("%20", " ");
    match std::fs::read(&path) {
        Ok(bytes) if bytes.len() <= 2 * 1024 * 1024 => {
            let kind = if bytes.starts_with(b"\x89PNG") {
                "png"
            } else {
                "jpeg"
            };
            format!(
                "data:image/{kind};base64,{}",
                base64::engine::general_purpose::STANDARD.encode(bytes)
            )
        }
        _ => String::new(),
    }
}
