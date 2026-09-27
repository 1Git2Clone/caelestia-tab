//! Registers the helper with Firefox-based browsers by writing its native
//! messaging manifest where each one looks for it.

use std::fs;
use std::io;
use std::path::PathBuf;

use serde_json::{Value, json};

use crate::plugins::home;

/// Must match `browser.runtime.connectNative` in extension/background.js.
/// Hyphens aren't allowed in a host name, hence the underscore.
const HOST: &str = "caelestia_tab";
/// Must match `browser_specific_settings.gecko.id` in extension/manifest.json.
const EXTENSION_ID: &str = "caelestia-tab@hu-tao.dev";

pub fn manifest() -> io::Result<Value> {
    Ok(json!({
        "name": HOST,
        "description": "caelestia colour scheme and wallpaper for caelestia-tab",
        "path": std::env::current_exe()?,
        "type": "stdio",
        "allowed_extensions": [EXTENSION_ID],
    }))
}

/// Firefox and Floorp read `~/.mozilla`; forks that renamed their home
/// directory read their own. Only forks that are installed get a copy.
fn dirs() -> Vec<PathBuf> {
    let home = home();
    let mut dirs = vec![home.join(".mozilla")];
    for fork in [".librewolf", ".zen", ".floorp", ".waterfox"] {
        if home.join(fork).is_dir() {
            dirs.push(home.join(fork));
        }
    }
    dirs.into_iter()
        .map(|d| d.join("native-messaging-hosts"))
        .collect()
}

pub fn install() -> io::Result<()> {
    let manifest = serde_json::to_string_pretty(&manifest()?)?;
    for dir in dirs() {
        fs::create_dir_all(&dir)?;
        let file = dir.join(format!("{HOST}.json"));
        fs::write(&file, &manifest)?;
        println!("wrote {}", file.display());
    }
    Ok(())
}

pub fn uninstall() -> io::Result<()> {
    for dir in dirs() {
        let file = dir.join(format!("{HOST}.json"));
        match fs::remove_file(&file) {
            Ok(()) => println!("removed {}", file.display()),
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
    }
    Ok(())
}
