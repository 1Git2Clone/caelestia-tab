//! Secrets by alias. `$XDG_CONFIG_HOME/caelestia-tab/secrets.toml` names each
//! secret and says where it lives; it holds no values itself:
//!
//! ```toml
//! [github]
//! sops = "~/secrets/secrets.yaml"   # decrypted with `sops -d`
//! key = "github.token"              # nested keys, dot-separated
//!
//! [weather]
//! command = "pass show weather"     # its first line of output
//!
//! [other]
//! env = "OTHER_TOKEN"               # or file = "~/.config/other/token"
//! ```
//!
//! Values are read when a plugin needs them and stay in the helper: they're
//! never sent to the extension, so no page, snapshot or storage sees them.

use std::collections::HashMap;
use std::io;
use std::path::PathBuf;
use std::process::Command;

use serde::Deserialize;

use crate::plugins::home;

#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
struct Source {
    sops: Option<String>,
    key: Option<String>,
    command: Option<String>,
    env: Option<String>,
    file: Option<String>,
}

fn config() -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME")
        .filter(|d| !d.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home().join(".config"))
        .join("caelestia-tab/secrets.toml")
}

fn expand(path: &str) -> PathBuf {
    match path.strip_prefix("~/") {
        Some(rest) => home().join(rest),
        None => PathBuf::from(path),
    }
}

/// The secret an alias names, or None when the alias isn't configured.
pub fn get(alias: &str) -> io::Result<Option<String>> {
    let text = match std::fs::read_to_string(config()) {
        Ok(text) => text,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e),
    };
    let mut all: HashMap<String, Source> = toml::from_str(&text).map_err(io::Error::other)?;
    let Some(source) = all.remove(alias) else {
        return Ok(None);
    };
    resolve(&source).map(Some)
}

fn resolve(source: &Source) -> io::Result<String> {
    let value = if let Some(file) = &source.sops {
        let key = source
            .key
            .as_deref()
            .ok_or_else(|| io::Error::other("a sops secret needs a key"))?;
        run(Command::new("sops")
            .args(["-d", "--extract", &extract(key)])
            .arg(expand(file)))?
    } else if let Some(command) = &source.command {
        run(Command::new("sh").args(["-c", command]))?
    } else if let Some(var) = &source.env {
        std::env::var(var).map_err(|_| io::Error::other(format!("{var} isn't set")))?
    } else if let Some(file) = &source.file {
        std::fs::read_to_string(expand(file))?
    } else {
        return Err(io::Error::other("says neither sops, command, env nor file"));
    };
    // A token is one line; a trailing newline from a file or a command isn't part of it.
    Ok(value.lines().next().unwrap_or_default().trim().to_owned())
}

/// sops's --extract path for a dotted key: `github.token` is
/// `["github"]["token"]`, and a number indexes a list: `tokens.0` is
/// `["tokens"][0]`.
fn extract(key: &str) -> String {
    key.split('.')
        .map(|part| {
            if part.bytes().all(|b| b.is_ascii_digit()) && !part.is_empty() {
                format!("[{part}]")
            } else {
                format!("[{:?}]", part)
            }
        })
        .collect()
}

fn run(command: &mut Command) -> io::Result<String> {
    let out = command.output()?;
    if !out.status.success() {
        return Err(io::Error::other(
            String::from_utf8_lossy(&out.stderr).trim().to_owned(),
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nested_keys_become_sops_paths() {
        assert_eq!(extract("github.token"), r#"["github"]["token"]"#);
        assert_eq!(extract("tokens.0.value"), r#"["tokens"][0]["value"]"#);
    }

    #[test]
    fn values_are_one_trimmed_line() {
        let s = Source {
            command: Some("printf 'tok123\\nrest\\n'".into()),
            ..Default::default()
        };
        assert_eq!(resolve(&s).unwrap(), "tok123");
        let none = Source::default();
        assert!(resolve(&none).is_err());
    }
}
