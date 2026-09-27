use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use base64::Engine;
use serde_json::{Value, json};

use super::Plugin;

/// The current wallpaper as a data URL. The extension can't read files, so the
/// image itself has to travel, not its path.
pub struct Wallpaper {
    path_txt: PathBuf,
}

impl Wallpaper {
    pub fn new(state: &Path) -> Self {
        Self {
            path_txt: state.join("wallpaper/path.txt"),
        }
    }
}

impl Plugin for Wallpaper {
    fn topic(&self) -> &'static str {
        "wallpaper"
    }

    fn watches(&self) -> Vec<PathBuf> {
        vec![self.path_txt.clone()]
    }

    fn read(&self) -> io::Result<Value> {
        let path = fs::read_to_string(&self.path_txt)?;
        let path = path.trim();
        let bytes = fs::read(path)?;
        let data = base64::engine::general_purpose::STANDARD.encode(bytes);
        Ok(json!({
            "path": path,
            "url": format!("data:{};base64,{data}", mime(path)),
        }))
    }
}

fn mime(path: &str) -> &'static str {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        _ => "image/jpeg",
    }
}
