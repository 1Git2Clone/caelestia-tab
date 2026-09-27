use std::collections::HashMap;
use std::io;
use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use base64::Engine;
use futures_util::StreamExt;
use futures_util::future::join_all;
use futures_util::stream::select_all;
use serde_json::{Value, json};
use tokio::sync::OnceCell;
use zbus::message::Type as MessageType;
use zbus::proxy::CacheProperties;
use zbus::zvariant::{ObjectPath, OwnedObjectPath, OwnedValue};
use zbus::{Connection, MatchRule, MessageStream, Proxy, fdo::DBusProxy};

use super::Plugin;
use crate::host::Wake;

const PREFIX: &str = "org.mpris.MediaPlayer2.";
const PATH: &str = "/org/mpris/MediaPlayer2";
const PLAYER: &str = "org.mpris.MediaPlayer2.Player";

/// Every MPRIS media player on the session bus (Spotify, mpv, a browser …):
/// what's playing, and play, pause, next, previous and seek from the new tab.
/// Read again whenever a player's properties change or a player comes or
/// goes. MPRIS doesn't signal the position as it moves, so each player's
/// value carries the position with the time it was read (`at`) and the rate,
/// and the widget moves it on from there.
#[derive(Default)]
pub struct Media {
    // One session bus connection for every read and command.
    bus: OnceCell<Connection>,
}

impl Media {
    async fn bus(&self) -> io::Result<&Connection> {
        self.bus
            .get_or_try_init(Connection::session)
            .await
            .map_err(io::Error::other)
    }
}

/// A proxy that asks the player every time rather than caching: a cached
/// proxy fetches everything and subscribes to changes when it's made, and
/// these are made per read.
async fn proxy<'a>(bus: &Connection, name: &'a str, interface: &'a str) -> zbus::Result<Proxy<'a>> {
    zbus::proxy::Builder::new(bus)
        .destination(name)?
        .path(PATH)?
        .interface(interface)?
        .cache_properties(CacheProperties::No)
        .build()
        .await
}

#[async_trait]
impl Plugin for Media {
    fn topic(&self) -> &'static str {
        "media"
    }

    fn start(&self, wake: Wake) {
        tokio::spawn(async move {
            if let Err(e) = listen(&wake).await {
                eprintln!("caelestia-tab: media: {e}");
            }
        });
    }

    async fn command(&self, message: &Value) -> io::Result<()> {
        let player = message["player"].as_str().unwrap_or_default();
        if !player.starts_with(PREFIX) {
            return Err(io::Error::other("not an MPRIS player"));
        }
        let p = proxy(self.bus().await?, player, PLAYER)
            .await
            .map_err(io::Error::other)?;
        // Only these: the extension names a player method, and nothing else
        // on the bus is reachable through here.
        match message["command"].as_str() {
            Some(m @ ("PlayPause" | "Play" | "Pause" | "Next" | "Previous")) => {
                p.call_method(m, &()).await.map(drop)
            }
            Some("SetPosition") => {
                let track = ObjectPath::try_from(message["track"].as_str().unwrap_or("/"))
                    .map_err(io::Error::other)?;
                let position = message["position"].as_i64().unwrap_or(0);
                p.call_method("SetPosition", &(track, position))
                    .await
                    .map(drop)
            }
            _ => return Err(io::Error::other(format!("unknown command {message}"))),
        }
        .map_err(io::Error::other)
    }

    async fn read(&self) -> io::Result<Value> {
        let bus = self.bus().await?;
        let names = DBusProxy::new(bus)
            .await
            .map_err(io::Error::other)?
            .list_names()
            .await
            .map_err(io::Error::other)?;
        let names: Vec<&str> = names
            .iter()
            .map(|n| n.as_str())
            // playerctld stands in for whichever player is active; every
            // player it stands for is listed under its own name anyway.
            .filter(|n| n.starts_with(PREFIX) && *n != "org.mpris.MediaPlayer2.playerctld")
            .collect();
        let players: Vec<Value> = join_all(names.into_iter().map(|name| player(bus, name)))
            .await
            .into_iter()
            .filter_map(Result::ok)
            .collect();
        Ok(json!({ "players": players }))
    }
}

/// Wakes the host on every change to a player: its properties, a seek, or a
/// player appearing or quitting.
async fn listen(wake: &Wake) -> zbus::Result<()> {
    let bus = Connection::session().await?;
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
    let mut streams = Vec::new();
    for rule in rules {
        streams.push(MessageStream::for_match_rule(rule, &bus, None).await?);
    }
    let mut signals = select_all(streams);
    while signals.next().await.is_some() {
        if !wake.refresh() {
            break;
        }
    }
    Ok(())
}

async fn player(bus: &Connection, name: &str) -> zbus::Result<Value> {
    let p = proxy(bus, name, PLAYER).await?;
    let root = proxy(bus, name, "org.mpris.MediaPlayer2").await?;
    let meta: HashMap<String, OwnedValue> = p.get_property("Metadata").await.unwrap_or_default();
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
        .and_then(|v| OwnedObjectPath::try_from(v.clone()).ok())
        .map(|p| p.to_string());
    let bool_of = async |k: &str| p.get_property::<bool>(k).await.unwrap_or(false);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let art = match text("mpris:artUrl") {
        Some(u) => Some(art(&u).await),
        None => None,
    };
    Ok(json!({
        "player": name,
        "identity": root.get_property::<String>("Identity").await.unwrap_or_else(|_| name.trim_start_matches(PREFIX).to_owned()),
        "status": p.get_property::<String>("PlaybackStatus").await.unwrap_or_default(),
        "title": text("xesam:title"),
        "artist": list("xesam:artist").join(", "),
        "album": text("xesam:album"),
        // xesam:contentCreated is a date; the year is what's shown.
        "year": text("xesam:contentCreated").and_then(|d| d.get(..4).map(str::to_owned)),
        // Some players send the lyrics themselves.
        "lyrics": text("xesam:asText"),
        "art": art,
        "track": track,
        "length": length,
        "position": p.get_property::<i64>("Position").await.ok(),
        "rate": p.get_property::<f64>("Rate").await.unwrap_or(1.0),
        "at": now,
        "canNext": bool_of("CanGoNext").await,
        "canPrevious": bool_of("CanGoPrevious").await,
        "canPlay": bool_of("CanPlay").await,
        "canPause": bool_of("CanPause").await,
        "canSeek": bool_of("CanSeek").await,
    }))
}

/// Cover art the new tab can show: an https URL as it is, a local file as a
/// data: URL, since an extension page can't load file://.
async fn art(url: &str) -> String {
    let Some(path) = url.strip_prefix("file://") else {
        return url.to_owned();
    };
    let path = path.replace("%20", " ");
    match tokio::fs::read(&path).await {
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
