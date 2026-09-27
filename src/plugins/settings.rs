use std::fs;
use std::io;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

use serde_json::{Value, json};

use super::{Plugin, home};

/// The new tab's settings, kept in `$XDG_CONFIG_HOME/caelestia-tab/settings.json`
/// as well as the browser's storage. The browser's copy goes when a temporary
/// add-on is removed (a browser restart does it) and isn't anything a
/// dotfiles repo can hold; this one stays, and can be edited by hand.
///
/// The extension sends `{ command: "save", settings }` after a change; the
/// value is the file's settings and when it last changed (`mtime`, ms), which
/// the extension compares with its own last change to tell a restore or a
/// hand edit from an echo of its own save.
pub struct Settings {
    path: PathBuf,
}

impl Settings {
    pub fn new() -> Self {
        let config = std::env::var_os("XDG_CONFIG_HOME")
            .filter(|d| !d.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| home().join(".config"));
        let dir = config.join("caelestia-tab");
        // The host watches the file's directory, which must exist when the
        // watch is set up, before the first save creates it.
        if let Err(e) = fs::create_dir_all(&dir) {
            eprintln!("caelestia-tab: {}: {e}", dir.display());
        }
        Self {
            path: dir.join("settings.json"),
        }
    }
}

impl Plugin for Settings {
    fn topic(&self) -> &'static str {
        "savedSettings"
    }

    fn watches(&self) -> Vec<PathBuf> {
        vec![self.path.clone()]
    }

    fn read(&self) -> io::Result<Value> {
        let text = match fs::read_to_string(&self.path) {
            Ok(text) => text,
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                return Ok(json!({ "settings": null }));
            }
            Err(e) => return Err(e),
        };
        // A half-written file fails here; the write that finishes it raises
        // another event.
        let settings: Value = serde_json::from_str(&text)?;
        let mtime = fs::metadata(&self.path)?
            .modified()?
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        Ok(json!({ "settings": settings, "mtime": mtime }))
    }

    fn command(&self, message: &Value) -> io::Result<()> {
        if message["command"] != "save" || !message["settings"].is_object() {
            return Err(io::Error::other(format!("unknown command {message}")));
        }
        write(&self.path, &message["settings"])
    }
}

/// Pretty JSON, written only when it differs (an unchanged file keeps its
/// mtime) and renamed into place, so a reader never sees half of it.
fn write(path: &PathBuf, settings: &Value) -> io::Result<()> {
    let text = serde_json::to_string_pretty(settings)? + "\n";
    if fs::read_to_string(path).ok().as_deref() == Some(text.as_str()) {
        return Ok(());
    }
    fs::create_dir_all(path.parent().unwrap_or(path))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text)?;
    fs::rename(tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_read_back_and_unchanged_saves_keep_the_file() {
        let dir =
            std::env::temp_dir().join(format!("caelestia-tab-settings-{}", std::process::id()));
        let plugin = Settings {
            path: dir.join("caelestia-tab/settings.json"),
        };
        assert_eq!(
            plugin.read().unwrap()["settings"],
            Value::Null,
            "no file yet"
        );

        let settings = json!({ "font": "Rubik", "widgets": [] });
        plugin
            .command(&json!({ "command": "save", "settings": settings }))
            .unwrap();
        let first = plugin.read().unwrap();
        assert_eq!(first["settings"], settings);

        std::thread::sleep(std::time::Duration::from_millis(20));
        plugin
            .command(&json!({ "command": "save", "settings": settings }))
            .unwrap();
        assert_eq!(
            plugin.read().unwrap()["mtime"],
            first["mtime"],
            "the same settings don't rewrite it"
        );

        assert!(
            plugin
                .command(&json!({ "command": "save", "settings": 3 }))
                .is_err()
        );
        fs::remove_dir_all(&dir).unwrap();
    }
}
