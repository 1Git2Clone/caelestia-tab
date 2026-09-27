# Zen's window

Zen ignores the WebExtension theme API, so neither caelestia-tab nor
CaelestiaFox can colour its window from the extension. caelestia-tab does it
with a Zen mod instead, and keeps it live with a small autoconfig script.

## How it works

1. **The mod.** On every scheme change, the helper writes
   `chrome/zen-themes/caelestia-tab/chrome.css` into every Zen profile it
   finds, and registers the mod in the profile's `zen-themes.json` once. The
   CSS gives the window the same primary tint on a darkened surface as the
   Tree Style Tab sidebar. It also sets Zen's accent (`--zen-primary-color`),
   the toolbar text colour and the colour scheme, so Zen follows light and
   dark mode.
2. **The reload.** Zen only reloads mods when the pref
   `zen.mods.updated-value-observer` flips; that's all its own "update mods"
   does. Nothing outside the browser can flip a pref in a running Zen, so
   `zen/caelestia-tab.cfg`, an autoconfig script, does it from inside. It
   checks the mod's `chrome.css` timestamp once a second and flips the pref
   when it changes. It reads that one file and sets that one pref, nothing
   else.

Without the script the mod still applies, but only when Zen starts, or when
you toggle a mod in Zen's settings.

Profiles are found through `profiles.ini` in `~/.config/zen` (current Zen),
`~/.zen` (older Zen) and `~/.var/app/app.zen_browser.zen/.zen` (the Flatpak).
The helper only runs while a browser with caelestia-tab is open, so that's
when the mod follows the scheme.

To turn it off, disable the caelestia-tab mod in Zen's settings. The helper
registers it once and never re-enables it.

## Installing the script

Autoconfig runs from Zen's install directory, not the profile, so it's
installed once per Zen install.

### Any distribution

```sh
sudo caelestia-tab install-zen            # looks in /opt/zen, /opt/zen-browser, /usr/lib/zen, …
sudo caelestia-tab install-zen /path/to/zen
```

This writes `defaults/pref/caelestia-tab.js` and `caelestia-tab.cfg` next to
Zen's binary, then restart Zen once. The directory is the one that holds the
`zen` binary and a `defaults/pref` folder. A package upgrade can remove the
files, so run it again after one.

Limits:

- **One autoconfig per install.** If something else already sets
  `general.config.filename` (a userChrome.js loader, a distribution's
  policies), the two collide. Merge `caelestia-tab.cfg` into the other one
  instead.
- **Flatpak and AppImage** installs are read-only, so the script can't be
  added. The mod still applies when Zen starts.

### Nix

The flake's `lib.wrapZen` adds the script to a wrapped Zen package:

```nix
home.packages = [
  (inputs.caelestia-tab.lib.wrapZen (
    inputs.zen-browser.packages.${pkgs.system}.beta.override {
      nativeMessagingHosts = [ inputs.caelestia-tab.packages.${pkgs.system}.default ];
    }
  ))
];
```

It also fixes two things in zen-browser-flake's wrapper that stop autoconfig
from running at all. The wrapper symlinks Zen's binary, so Zen runs from the
unwrapped package's directory, which has no autoconfig: `wrapZen` copies the
binary, as nixpkgs' own Firefox wrapper does. And it turns off the
autoconfig sandbox, which would otherwise leave the script with prefs only.

## Why autoconfig is safe enough here

An autoconfig script runs with the browser's full privileges, which is why
Firefox sandboxes it by default and why caelestia-tab keeps this one small:
a timer, one `stat`, one pref. Read it before installing it:
[`zen/caelestia-tab.cfg`](https://git.hu-tao.dev/hutao/caelestia-tab/src/branch/main/zen/caelestia-tab.cfg).
