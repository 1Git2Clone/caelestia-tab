# caelestia-tab

[![CI Icon]][CI Status]&emsp;[![Pages Icon]][Pages Status]&emsp;[![Handbook Icon]][Handbook]&emsp;[![License Icon]][License]&emsp;[![Rust Icon]][Rust]

[CI Icon]: https://git.hu-tao.dev/hutao/caelestia-tab/badges/workflows/ci.yml/badge.svg
[CI Status]: https://git.hu-tao.dev/hutao/caelestia-tab/actions
[Pages Icon]: https://git.hu-tao.dev/hutao/caelestia-tab/badges/workflows/pages.yml/badge.svg
[Pages Status]: https://git.hu-tao.dev/hutao/caelestia-tab/actions
[Handbook Icon]: https://img.shields.io/badge/docs-handbook-7aa2f7
[Handbook]: https://pages.hu-tao.dev/hutao/caelestia-tab/docs/
[License Icon]: https://img.shields.io/badge/license-MIT-blue.svg
[License]: LICENSE
[Rust Icon]: https://img.shields.io/badge/rust-2024-orange.svg
[Rust]: Cargo.toml

A new tab, and site themes, that follow the
[caelestia](https://github.com/caelestia-dots) colour scheme live, for Firefox
and Firefox-based browsers (Floorp, Zen, LibreWolf, Waterfox).

- **The new tab** takes the scheme's colours and the current wallpaper, and
  changes the moment you switch schemes. It has a clock, bookmarks on a CSS
  grid you define yourself, and a menu over the clock with a GitHub tab (your
  pull requests and issues) and a Media tab (any MPRIS player, the Spotify
  app, mpv or your browser, with its controls and timed lyrics). The pen edits
  every part of it in place.
- **Site themes**: the 134 [catppuccin/userstyles](https://github.com/catppuccin/userstyles),
  compiled against the live scheme instead of a Catppuccin flavour.
- **Your own styles**: every page gets the scheme as `--caelestia-*` CSS
  variables, plus a `caelestia-scheme` event, for Stylus and userscripts.
- **Nerd Font glyphs** on bookmarks, bundled, with suggestions from the
  address: a GitHub bookmark is offered every GitHub glyph.
- **Your own menu tabs**, built in from `~/.config/caelestia-tab/components`,
  with the helper's data. GitHub needs no setup if you use `gh` or git
  already; secrets stay in the helper, named by alias, from SOPS, a command, a
  file or the environment.
- **Tree Style Tab**'s sidebar in the scheme too, live: a tint, or the
  wallpaper.
- **Zen's window** in the scheme too, live: Zen ignores the theme API, so
  it's done with a Zen mod and a small autoconfig script.
- **Every part is a component**: the clock, the toolbar, the bookmarks and
  the tabs are Svelte components whose settings forms are drawn from what
  they declare.

The browser's window frame is [CaelestiaFox](https://addons.mozilla.org/en-US/firefox/addon/caelestiafox)'s
job; the two work side by side.

## Quick start

```sh
nix profile install git+https://git.hu-tao.dev/hutao/caelestia-tab   # or: cargo install --git …
caelestia-tab install          # register the helper with your browsers
```

Then build the extension (`npm ci --prefix extension && npm run --prefix extension build`)
and load `extension/dist/manifest.json` from `about:debugging` (*This Firefox*,
*Load Temporary Add-on…*), and open a new tab. The handbook's
[Installing](https://pages.hu-tao.dev/hutao/caelestia-tab/docs/guides/installing.html)
chapter covers permanent installs, Home Manager, and the site-theme
permission.

## Documentation

The [handbook](https://pages.hu-tao.dev/hutao/caelestia-tab/docs/) (source in
[`docs/src/`](docs/src/SUMMARY.md)):

| Chapter | What it covers |
| --- | --- |
| [Installing](docs/src/guides/installing.md) | The helper, the extension, Nix and Home Manager |
| [Browsers](docs/src/guides/browsers.md) | Where each browser looks for the helper, per-browser quirks |
| [Zen's window](docs/src/guides/zen.md) | The Zen mod, and the script that reloads it live |
| [The page and its tabs](docs/src/guides/widgets.md) | The page's parts, the GitHub and Media tabs, the helper's data, and secrets |
| [Writing a menu tab](docs/src/guides/plugins.md) | Tabs of your own and their settings, and data plugins in the helper |
| [Theming your own sites](docs/src/guides/own-styles.md) | The `--caelestia-*` variables in Stylus and userscripts |
| [Development](docs/src/guides/development.md) | The dev shell, checks, running it, refreshing the vendored styles |
| [How the pieces talk](docs/src/architecture/overview.md) | Helper, storage, new tab, content scripts |
| [The helper](docs/src/architecture/helper.md) | Data plugins, watching, the wire format |
| [The new tab](docs/src/architecture/newtab.md) | Settings, rendering, the bookmark grid |
| [Site themes](docs/src/architecture/site-themes.md) | How the Catppuccin styles get the live scheme |
| [Known hazards](docs/src/architecture/hazards.md) | The non-obvious things |

What's planned next lives in [IDEAS.md](IDEAS.md).

## Development

```sh
nix develop
sh scripts/setup-hooks.sh
cargo test && node --test tests/*.test.mjs && web-ext lint --source-dir extension --self-hosted
```

Contributors and agents: read [AGENTS.md](AGENTS.md) first.

## Licence

MIT, see [LICENSE](LICENSE). The vendored
[catppuccin/userstyles](extension/public/userstyles/LICENSE) are MIT,
[less.js](extension/public/vendor/less.LICENSE) is Apache-2.0, and the
[Nerd Fonts symbols](extension/public/vendor/nerd-fonts/LICENSE) are MIT, with each
glyph set under its own licence
([Nerd Fonts' licence audit](https://github.com/ryanoasis/nerd-fonts/blob/master/license-audit.md)).
