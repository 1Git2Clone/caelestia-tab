# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `caelestia-tab`, the native messaging helper. It streams caelestia's scheme and wallpaper to the extension and resends them when they change. `caelestia-tab install` registers it with Firefox, Floorp, Zen, LibreWolf and Waterfox.
- The extension: a new tab whose colours and wallpaper follow the scheme live, built with Svelte 5, TypeScript and Tailwind. It has a clock and date widget, and a bookmarks widget laid out on a user-defined CSS grid with Tiles and List presets, or in even rows (5, or 3 and 2, never 4 and 1). An edit mode lets you reorder (drag, or the arrows), edit and remove tiles; the controls sit under each tile's name and mark.
- Settings open as a panel beside the page, so changes show as you make them. Widgets are components that declare their settings, and the panel draws each one's form from that.
- The clock's time and date each take their own separator and size, with a weight, a leading-zero option, four date styles, and the glass behind it optional.
- A tile's colour can be a fixed one from the browser's colour picker as well as a scheme colour, and the scheme colours are named under their swatches. Uploaded tile images are scaled to what a tile shows.
- A widget flush with a window edge squares its corners on that side.
- The page is a CSS grid you define, and every widget, the toolbar included, sits where you place it. Widgets are added from *Settings*, *General*, and edited from the page: edit mode gives each one an overlay that opens its properties and placement in the side panel. Every editor, a bookmark's included, opens there and applies as you type; there are no pop-ups.
- A page font (*Settings*, *General*), and fonts for the clock's time and date. Font fields autocomplete from the installed fonts, listed by the helper, each shown in its own face. Font sizes are in pt.
- Tree Style Tab's sidebar takes the background's choices and fields: a colour dimmed towards the surface, the wallpaper dimmed and blurred, or TST's own look.
- Settings only show a field when it applies: a colour when the source is a colour, a blur when it's the wallpaper.
- A media widget for any MPRIS player (the Spotify app, mpv, a browser): what's playing, its cover and progress, and previous, play or pause, next and seek.
- A GitHub widget: your pull requests and issues as GitHub searches you choose. The helper finds a token without setup (`gh`, git's credential helper or the environment), caches with ETags, and keeps the token to itself.
- Secrets by alias in `~/.config/caelestia-tab/secrets.toml`: from SOPS (nested keys), a command, a file or the environment. Values never reach the extension.
- The helper takes commands from the extension, for widgets that control something on the machine.
- Nerd Font glyphs as a bookmark's mark. The symbols font is bundled, and the editor shows every glyph with a search by name, and suggests glyphs from the bookmark's address and name.
- Zen's window follows the scheme live. The helper writes a Zen mod into every Zen profile, and `zen/caelestia-tab.cfg` (installed with `caelestia-tab install-zen`, or `lib.wrapZen` on Nix) reloads it on each change.
- The clock sits on the same glass as the bookmarks, so it stays legible over any wallpaper, dark text in light mode included.
- Tree Style Tab's sidebar is tinted towards the scheme's primary and follows switches live. It can be turned off, and its strength set, in *Settings*, *Browser*.
- Site themes: the 134 catppuccin/userstyles, compiled against the live scheme and injected per site. Every page also gets the scheme as `--caelestia-*` CSS variables and a `caelestia-scheme` event, for your own Stylus styles and userscripts.
- Per-site overrides in *Settings*, *Websites*: more domains for a style, a CSS selector that applies it to matching pages wherever they're hosted, and your own CSS on top. The docs carry recipes for mdBook on any domain and for claude.ai's current design.
