# Browsers

One extension covers every Firefox-based browser. What differs is where each
one looks for the helper's manifest, and a few browser settings.

| Browser | Manifest directory | Notes |
| --- | --- | --- |
| Firefox | `~/.mozilla/native-messaging-hosts/` | |
| Floorp | `~/.mozilla/native-messaging-hosts/` | Floorp keeps Firefox's lookup, even though its profiles live elsewhere (read from its `omni.ja`, 2026-09-26). |
| Zen | `~/.mozilla/native-messaging-hosts/` | Like Floorp, though its profiles live in `~/.zen` (confirmed with Zen 1.22.3b, 2026-09-27). See the new tab note below. |
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

Out of the box Zen opens its command bar instead of a new tab page, so the
new tab never shows. Set `zen.urlbar.replace-newtab` to `false` in
`about:config` (it defaults to `true` in Zen 1.22.3b).

## Tree Style Tab

With [Tree Style Tab](https://addons.mozilla.org/en-US/firefox/addon/tree-style-tab/)
installed, its sidebar follows the scheme live, with the same choices as the
new tab's background (*Settings*, *Browser*):

- **A colour** (the default: primary, dimmed 86%): the colour dimmed towards
  the surface mixed towards black (40% in dark mode, 12% in light, where
  surfaces grey quickly), so it sits a step darker than the page in both
  modes and a high dim is a light tint.
- **The caelestia wallpaper**, dimmed towards the scheme's background and
  blurred as you set, with the tabs on a translucent tint of primary. *X
  offset* and *Y offset* (-100% to 100%, 0 centred) move it: -100 lines up
  its left or top edge with the sidebar's, 100 its right or bottom. The
  sidebar gets a copy scaled to 900 px, since TST keeps the style in every
  sidebar.
- **Tree Style Tab's own** look.

The fields are the background's: the colour shows when the source is a
colour, and the blur and offsets when it's the wallpaper. A tint set up before this, with
its *Strength*, carries over as the same colour dimmed by 100 minus it.

It goes through TST's own API: caelestia-tab registers with TST and hands it
a stylesheet, so it needs no permission, and nothing happens without TST.
The wallpaper option is unit-tested for the CSS it produces
(`tests/extension.test.mjs`); how it looks in a real sidebar is unconfirmed.

## Zen's own window

Zen ignores the WebExtension theme API: a test extension that set every theme
colour to something garish recoloured Firefox completely and changed nothing
in Zen 1.22.3b (2026-09-27). So CaelestiaFox doesn't reach Zen's window
either. caelestia-tab colours it with a Zen mod, kept live by a small
autoconfig script; see [Zen's window](zen.md).

## Tested with

Checked on 2026-09-27, each with the extension loaded through `web-ext run`,
the helper registered by `caelestia-tab install`, and live wallpaper switches
through `caelestia wallpaper`:

| Browser | Version | New tab | Live switch | Site themes |
| --- | --- | --- | --- | --- |
| Firefox | 156 | yes | yes | yes (GitHub, YouTube) |
| Floorp | 12.17 | yes | yes | yes (GitHub, YouTube, logged in) |
| Zen | 1.22.3b | yes | yes | yes (GitHub, YouTube) |

YouTube's cookie-consent overlay, shown to a logged-out visitor, keeps its own
colours; the catppuccin style doesn't cover it.

## Chrome and Chromium

Not yet. The extension uses the `browser.*` namespace, and Chrome's service
worker background has no DOM, which the bundled less.js expects. Chrome
support is planned in [IDEAS.md](https://git.hu-tao.dev/hutao/caelestia-tab/src/branch/main/IDEAS.md).
