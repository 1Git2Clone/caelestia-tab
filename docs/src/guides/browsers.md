# Browsers

One extension covers every Firefox-based browser. What differs is where each
one looks for the helper's manifest, and a few browser settings.

| Browser | Manifest directory | Notes |
| --- | --- | --- |
| Firefox | `~/.mozilla/native-messaging-hosts/` | |
| Floorp | `~/.mozilla/native-messaging-hosts/` | Floorp keeps Firefox's lookup, even though its profiles live elsewhere (read from its `omni.ja`, 2026-09-26). |
| Zen | `~/.zen/native-messaging-hosts/` or `~/.mozilla/…` | Not yet confirmed which; `install` writes both, so either works. See the new tab note below. |
| LibreWolf | `~/.librewolf/native-messaging-hosts/` | |
| Waterfox | `~/.waterfox/native-messaging-hosts/` | |

`caelestia-tab install` writes to `~/.mozilla` always, and to a fork's own
directory only if the fork's home directory already exists. So install the
browser first, then run `install`.

## Is the helper connected?

Open *Settings*, *Advanced* on the new tab. *Status* shows the scheme it
received, or the browser's reason it couldn't start the helper. The usual one
is "No such native application caelestia_tab": the manifest isn't where the
browser looks, or its `path` points at a binary that's gone.

The helper's own errors (a scheme file it can't parse, a wallpaper it can't
read) go to the extension's console: `about:debugging`, caelestia-tab,
*Inspect*.

## Zen's new tab

Zen can open its command bar instead of a new tab page. If the new tab never
shows, look in Zen's settings, or `about:config` under `zen.urlbar`, for the
option that replaces the new tab. The preference name has changed between Zen
releases, so check yours.

## Chrome and Chromium

Not yet. The extension uses the `browser.*` namespace, and Chrome's service
worker background has no DOM, which the bundled less.js expects. Chrome
support is planned in [IDEAS.md](https://git.hu-tao.dev/hutao/caelestia-tab/src/branch/main/IDEAS.md).
