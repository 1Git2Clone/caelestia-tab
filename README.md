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
  changes the moment you switch schemes. It has a clock, and bookmarks on a
  CSS grid you define yourself. A bookmark shows an image or a solid scheme
  colour, and the pen button lets you rearrange and edit bookmarks in place.
- **Site themes**: the 134 [catppuccin/userstyles](https://github.com/catppuccin/userstyles),
  compiled against the live scheme instead of a Catppuccin flavour.
- **Your own styles**: every page gets the scheme as `--caelestia-*` CSS
  variables, plus a `caelestia-scheme` event, for Stylus and userscripts.
- **Nerd Font glyphs** on bookmarks, bundled, with suggestions from the
  address: a GitHub bookmark is offered every GitHub glyph.
- **Tree Style Tab**'s sidebar tinted towards the scheme's primary, live, and
  optional.
- **Everything is a plugin**, the built-in widgets included.

The browser's window frame is [CaelestiaFox](https://addons.mozilla.org/en-US/firefox/addon/caelestiafox)'s
job; the two work side by side.

## Quick start

```sh
nix profile install git+https://git.hu-tao.dev/hutao/caelestia-tab   # or: cargo install --git …
caelestia-tab install          # register the helper with your browsers
```

Then load `extension/manifest.json` from `about:debugging` (*This Firefox*,
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
| [Writing a plugin](docs/src/guides/plugins.md) | The widget API, and data plugins in the helper |
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
[catppuccin/userstyles](extension/userstyles/LICENSE) are MIT,
[less.js](extension/vendor/less.LICENSE) is Apache-2.0, and the
[Nerd Fonts symbols](extension/vendor/nerd-fonts/LICENSE) are MIT, with each
glyph set under its own licence
([Nerd Fonts' licence audit](https://github.com/ryanoasis/nerd-fonts/blob/master/license-audit.md)).
