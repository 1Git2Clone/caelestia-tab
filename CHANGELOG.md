# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `caelestia-tab`, the native messaging helper. It streams caelestia's scheme and wallpaper to the extension and resends them when they change. `caelestia-tab install` registers it with Firefox, Floorp, Zen, LibreWolf and Waterfox.
- The extension: a new tab whose colours and wallpaper follow the scheme live. It has a clock and date widget, and a bookmarks widget laid out on a user-defined CSS grid with Tiles and List presets. An edit mode lets you reorder (drag, or the arrows), edit and remove tiles.
- Nerd Font glyphs as a bookmark's mark. The symbols font is bundled, and the editor suggests glyphs from the bookmark's address and name, searches all of them by name, or takes a glyph, a name (`nf-fa-github`) or a codepoint.
- Zen's window follows the scheme live. The helper writes a Zen mod into every Zen profile, and `zen/caelestia-tab.cfg` (installed with `caelestia-tab install-zen`, or `lib.wrapZen` on Nix) reloads it on each change.
- The clock sits on the same glass as the bookmarks, so it stays legible over any wallpaper, dark text in light mode included.
- Tree Style Tab's sidebar is tinted towards the scheme's primary and follows switches live. It can be turned off, and its strength set, in *Settings*, *Browser*.
- Site themes: the 134 catppuccin/userstyles, compiled against the live scheme and injected per site. Every page also gets the scheme as `--caelestia-*` CSS variables and a `caelestia-scheme` event, for your own Stylus styles and userscripts.
