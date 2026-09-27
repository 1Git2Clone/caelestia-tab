//! Zen's own window. Zen ignores the WebExtension theme API, so its colours
//! go in as a Zen mod: CSS in each profile, which the helper rewrites on every
//! scheme change. Zen reloads mods live only when a pref flips; the autoconfig
//! script in zen/ (installed by `install-zen`) does that when the file changes.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value, json};

use crate::plugins::home;

const MOD: &str = "caelestia-tab";

/// Every Zen profile on the machine: the native install's (`~/.zen`, or
/// `$XDG_CONFIG_HOME/zen` in newer releases) and the Flatpak's.
fn profiles() -> Vec<PathBuf> {
    let home = home();
    let config = std::env::var_os("XDG_CONFIG_HOME")
        .filter(|d| !d.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".config"));
    let roots = [
        home.join(".zen"),
        config.join("zen"),
        home.join(".var/app/app.zen_browser.zen/.zen"),
    ];
    let mut out = Vec::new();
    for root in roots {
        let Ok(ini) = fs::read_to_string(root.join("profiles.ini")) else {
            continue;
        };
        out.extend(profile_paths(&root, &ini));
    }
    out
}

/// The `Path=` of each `[Profile*]` section, resolved against `root` unless
/// its section says `IsRelative=0`.
fn profile_paths(root: &Path, ini: &str) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let (mut path, mut relative, mut in_profile) = (None, true, false);
    let mut flush = |path: &mut Option<String>, relative: bool| {
        if let Some(p) = path.take() {
            out.push(if relative {
                root.join(p)
            } else {
                PathBuf::from(p)
            });
        }
    };
    for line in ini.lines().map(str::trim) {
        if line.starts_with('[') {
            flush(&mut path, relative);
            in_profile = line.starts_with("[Profile");
            relative = true;
        } else if in_profile {
            if let Some(p) = line.strip_prefix("Path=") {
                path = Some(p.to_owned());
            } else if let Some(r) = line.strip_prefix("IsRelative=") {
                relative = r != "0";
            }
        }
    }
    flush(&mut path, relative);
    out
}

/// The mod's CSS. Zen paints its window with a gradient it sets inline on
/// #zen-browser-background, crossfading between it and an `-old` copy, so
/// both are overridden there as well as on :root. The background is the same
/// primary tint on a darkened surface as the Tree Style Tab sidebar's.
pub fn css(scheme: &Value) -> Option<String> {
    let c = |name: &str| {
        scheme["colours"][name]
            .as_str()
            .map(|hex| format!("#{hex}"))
    };
    let mode = scheme["mode"].as_str().unwrap_or("dark");
    let darken = if mode == "light" { 12 } else { 40 };
    let (primary, surface, shadow, text) =
        (c("primary")?, c("surface")?, c("shadow")?, c("onSurface")?);
    let bg = format!(
        "color-mix(in srgb, {primary} 14%, color-mix(in srgb, {surface}, {shadow} {darken}%))"
    );
    Some(format!(
        "/* Written by caelestia-tab from the caelestia scheme; rewritten on every switch. */
:root, #zen-browser-background, .zen-browser-generic-background {{
  --zen-main-browser-background: {bg} !important;
  --zen-main-browser-background-toolbar: {bg} !important;
  --zen-main-browser-background-old: {bg} !important;
  --zen-main-browser-background-toolbar-old: {bg} !important;
}}
:root {{
  --zen-primary-color: {primary} !important;
  --toolbox-textcolor: {text} !important;
  --toolbar-color-scheme: {mode} !important;
  color-scheme: {mode} !important;
}}
"
    ))
}

/// Writes the mod into every Zen profile. A profile whose mods file can't be
/// parsed is skipped, not reset: that file also lists the user's own mods.
pub fn write_mods(scheme: &Value) {
    let Some(css) = css(scheme) else { return };
    for profile in profiles() {
        if let Err(e) = write_mod(&profile, &css) {
            eprintln!("caelestia-tab: zen mod in {}: {e}", profile.display());
        }
    }
}

fn write_mod(profile: &Path, css: &str) -> io::Result<()> {
    let dir = profile.join("chrome/zen-themes").join(MOD);
    fs::create_dir_all(&dir)?;
    let file = dir.join("chrome.css");
    // An unchanged file keeps its timestamp, so Zen doesn't reload for nothing.
    if fs::read_to_string(&file).ok().as_deref() != Some(css) {
        fs::write(&file, css)?;
    }

    let registry = profile.join("zen-themes.json");
    let mut mods: Map<String, Value> = match fs::read_to_string(&registry) {
        Ok(text) => serde_json::from_str(&text).map_err(io::Error::other)?,
        Err(e) if e.kind() == io::ErrorKind::NotFound => Map::new(),
        Err(e) => return Err(e),
    };
    // Registered once; after that the entry is the user's, and disabling the
    // mod in Zen's settings sticks.
    if !mods.contains_key(MOD) {
        mods.insert(
            MOD.into(),
            json!({
                "id": MOD,
                "name": "caelestia-tab",
                "description": "Zen's window in the live caelestia scheme",
                "author": "caelestia-tab",
                "enabled": true,
            }),
        );
        fs::write(&registry, serde_json::to_string(&mods)?)?;
    }
    Ok(())
}

const PREF_FILE: &str = include_str!("../zen/defaults/pref/caelestia-tab.js");
const CFG_FILE: &str = include_str!("../zen/caelestia-tab.cfg");

/// Where distributions and Zen's own tarball put it. `install-zen DIR`
/// covers anything else.
const INSTALL_DIRS: [&str; 5] = [
    "/opt/zen",
    "/opt/zen-browser",
    "/usr/lib/zen",
    "/usr/lib/zen-browser",
    "/usr/lib64/zen-browser",
];

/// Installs the autoconfig watcher next to Zen's binary. Needs write access
/// to the install directory, so usually root.
pub fn install(dir: Option<&str>) -> io::Result<()> {
    let dir = match dir {
        Some(d) => PathBuf::from(d),
        None => INSTALL_DIRS
            .iter()
            .map(PathBuf::from)
            .find(|d| d.join("defaults/pref").is_dir())
            .ok_or_else(|| {
                io::Error::other(
                    "no Zen install found; pass its directory: caelestia-tab install-zen DIR",
                )
            })?,
    };
    if !dir.join("defaults/pref").is_dir() {
        return Err(io::Error::other(format!(
            "{} has no defaults/pref; is it Zen's install directory?",
            dir.display()
        )));
    }
    let pref = dir.join("defaults/pref/caelestia-tab.js");
    let cfg = dir.join("caelestia-tab.cfg");
    fs::write(&pref, PREF_FILE)?;
    fs::write(&cfg, CFG_FILE)?;
    println!(
        "wrote {}\nwrote {}\nrestart Zen once to load them",
        pref.display(),
        cfg.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profiles_ini_paths() {
        let ini = "[General]\nStartWithLastProfile=1\n\n[Profile1]\nName=b\nIsRelative=0\nPath=/abs/b\n\n[Profile0]\nName=a\nIsRelative=1\nPath=Profiles/a.default\n\n[Install123]\nDefault=Profiles/a.default\n";
        assert_eq!(
            profile_paths(Path::new("/r"), ini),
            vec![
                PathBuf::from("/abs/b"),
                PathBuf::from("/r/Profiles/a.default")
            ]
        );
    }

    #[test]
    fn mod_css_and_registry() {
        let scheme = json!({ "mode": "light", "colours": { "primary": "aa0000", "surface": "ffffff", "shadow": "000000", "onSurface": "111111" } });
        let css = css(&scheme).unwrap();
        assert!(css.contains("--zen-primary-color: #aa0000 !important;"));
        assert!(css.contains("#ffffff, #000000 12%"));
        assert!(css.contains("color-scheme: light !important;"));

        let dir = std::env::temp_dir().join(format!("caelestia-tab-zen-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("zen-themes.json"),
            r#"{"other":{"id":"other","enabled":true}}"#,
        )
        .unwrap();
        write_mod(&dir, &css).unwrap();
        let mods: Value =
            serde_json::from_str(&fs::read_to_string(dir.join("zen-themes.json")).unwrap())
                .unwrap();
        assert_eq!(mods["other"]["id"], "other", "the user's own mods stay");
        assert_eq!(mods[MOD]["enabled"], true);

        // Disabled by the user: stays disabled on the next write.
        fs::write(
            dir.join("zen-themes.json"),
            r#"{"caelestia-tab":{"id":"caelestia-tab","enabled":false}}"#,
        )
        .unwrap();
        write_mod(&dir, &css).unwrap();
        let mods: Value =
            serde_json::from_str(&fs::read_to_string(dir.join("zen-themes.json")).unwrap())
                .unwrap();
        assert_eq!(mods[MOD]["enabled"], false);
        fs::remove_dir_all(&dir).unwrap();
    }
}
