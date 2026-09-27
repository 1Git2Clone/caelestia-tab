//! Data plugins: each one turns something on the machine (a file, a service,
//! an API) into a JSON value the extension receives under the plugin's topic.
//! Add one by implementing [`Plugin`] and listing it in [`all`].

mod fonts;
mod github;
mod media;
mod scheme;
mod settings;
mod wallpaper;

use std::io;
use std::path::PathBuf;

use serde_json::Value;

use crate::host::Wake;

pub trait Plugin {
    /// The key the extension stores this plugin's value under.
    fn topic(&self) -> &'static str;

    /// Files whose changes mean the value should be read again. Their parent
    /// directories are what's watched, so a file that doesn't exist yet, or
    /// that is replaced by a rename, still counts.
    fn watches(&self) -> Vec<PathBuf> {
        Vec::new()
    }

    /// The current value. An error is logged and nothing is sent; the next
    /// change to a watched file tries again.
    fn read(&self) -> io::Result<Value>;

    /// Runs after a new value was sent, for plugins that also write
    /// something of their own out.
    fn changed(&self, _value: &Value) {}

    /// Starts whatever else changes the value, once: a timer, a D-Bus
    /// subscription. Send `Event::Refresh(self.topic())` on `wake` to be read
    /// again. Run it on a thread of its own; this returns straight away.
    fn start(&self, _wake: Wake) {}

    /// A message from the extension for this topic. The value is read again
    /// after it, so a command's effect shows without waiting for anything.
    fn command(&self, _message: &Value) -> io::Result<()> {
        Err(io::Error::other("takes no commands"))
    }
}

pub fn all() -> Vec<Box<dyn Plugin>> {
    let state = caelestia_state();
    vec![
        Box::new(scheme::Scheme::new(&state)),
        Box::new(wallpaper::Wallpaper::new(&state)),
        Box::new(fonts::Fonts),
        Box::new(github::GitHub::new()),
        Box::new(media::Media),
        Box::new(settings::Settings::new()),
    ]
}

/// `$XDG_STATE_HOME/caelestia`, which is where the caelestia CLI writes.
fn caelestia_state() -> PathBuf {
    std::env::var_os("XDG_STATE_HOME")
        .filter(|dir| !dir.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home().join(".local/state"))
        .join("caelestia")
}

pub fn home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default()
}
