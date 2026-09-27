use std::io;
use std::path::{Path, PathBuf};

use async_trait::async_trait;
use serde_json::Value;

use super::Plugin;

/// caelestia's current scheme, as written to `scheme.json`: the name, the
/// mode (`dark` or `light`) and every colour as a hex string without `#`.
pub struct Scheme {
    path: PathBuf,
}

impl Scheme {
    pub fn new(state: &Path) -> Self {
        Self {
            path: state.join("scheme.json"),
        }
    }
}

#[async_trait]
impl Plugin for Scheme {
    fn topic(&self) -> &'static str {
        "scheme"
    }

    fn watches(&self) -> Vec<PathBuf> {
        vec![self.path.clone()]
    }

    async fn read(&self) -> io::Result<Value> {
        // A half-written file fails to parse; the write that finishes it
        // raises another event.
        Ok(serde_json::from_slice(&tokio::fs::read(&self.path).await?)?)
    }

    // Zen's window can't be themed from the extension, only through a mod.
    fn changed(&self, value: &Value) {
        crate::zen::write_mods(value);
    }
}
