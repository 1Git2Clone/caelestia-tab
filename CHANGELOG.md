# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- *Padding* for the page's sides, top and bottom, tied or per axis, in *Settings*, *General*; 1.25rem on every side by default.
- *Hide* on every part and tab, last in its own pen: the toolbar's warns that Ctrl+, still opens Settings without it, and a hidden open tab gives way to the first one still shown.
- *Components* in Settings: every part as one tree, the menu's tabs indented under it, with a switch to show or hide each and a row that opens its settings, hidden ones included; a user's own carries a *yours* label, and a tab's switch greys and disables while its menu is hidden (its own setting untouched).
- Bookmarks: *Placement*, floating (rounded like the menu, with the page's own padding under it) or docked (flush with the window's bottom edge). *Top line* and *Line colour*, for the border along its top edge.
- Bookmarks: a *Bookmarks* screen in its own settings lists every one, reordered by dragging its handle or Alt+Up/Down, each with a switch to show or hide it (off leaves no tile on the page); *Show hidden bookmarks while editing* dims them into edit mode instead, their own edit bar still working.

### Changed

- Settings: the six main tabs slide sideways like the menu's own tabs, and a screen opening (the pen, a Components row, a bookmark) slides up over whatever was showing, with back sliding it down again; opening the panel itself is unchanged. Back goes to the screen a sub-screen was opened from, else to the main settings, even when a pen opened one screen while another was already open.
- *Media*: beside the lyrics, the cover, title and controls sit on a card tinted with the scheme's primary container.
- The pen's outline is drawn inside each part rather than around it, so it no longer loses sides to the menu's panel clipping it or a bookmark sitting flush on the window's edge. The menu itself now has a pen box of its own, editable as a whole.
- Bookmarks: the grid's settings are numbers now (a flow switch, a count, row height and gap in rem) rather than CSS strings; older settings are carried over.
- Hidden bookmarks, or none, give the menu the whole page; in edit mode an empty list stays on the page for its pen box.

### Removed

- Bookmarks: *Even rows* and *Narrowest tile* (the grid always fills gaps as tiles are added).

## [0.1.1] - 2026-09-29

### Changed

- GitHub's recent activity is a line among your searches (`Label: @activity`), placed and labelled like one, in place of a checkbox that added a second column. A repeated search is one column, and a half-typed `Label:` is no longer searched for as text.
- A push in your activity reads as its short SHA and links to that commit.
- The refresh button spins until the new results are in.

### Added

- *Private activity*: off, every GitHub column is public repositories only (searches get `is:public`, activity is your public events). Both sides are kept, so flipping it doesn't ask GitHub again.
- *X offset* and *Y offset* for Tree Style Tab's wallpaper, in *Settings*, *Browser*: -100% to 100%, centred at 0, to move the part of the wallpaper the narrow sidebar shows.

## [0.1.0] - 2026-09-28

### Added

- `caelestia-tab`, the native messaging helper. It streams caelestia's scheme and wallpaper to the extension and resends them when they change. `caelestia-tab install` registers it with Firefox, Floorp, Zen, LibreWolf and Waterfox.
- The extension: a new tab whose colours and wallpaper follow the scheme live, built with Svelte 5, TypeScript and Tailwind. It has a clock and date, and bookmarks laid out on a user-defined CSS grid with Tiles and List presets, or in even rows (5, or 3 and 2, never 4 and 1). An edit mode lets you reorder (drag, or the arrows), edit and remove tiles; the controls sit under each tile's name and mark.
- Settings slide in as a panel beside the page, so changes show as you make them. The page's parts are components that declare their settings, and the panel draws each one's form from that.
- The clock's time and date each take their own separator and size, with a weight, a leading-zero option, four date styles, and the glass behind it optional.
- A tile's colour can be a fixed one from the browser's colour picker as well as a scheme colour, and the scheme colours are named under their swatches. Uploaded tile images are scaled to what a tile shows.
- The bookmarks square their corners on a window edge they touch.
- A fixed page: a bar with the menu and the toolbar (which can sit on either side or in the middle), the clock, and the bookmarks. The pen edits each part from the page, opening its settings in the side panel; every editor, a bookmark's included, opens there and applies as you type, and there are no pop-ups.
- A menu over the clock, growing out of its button and sliding between tabs, that stays open or closed, on the tab you left, across new tabs. GitHub shows your searches as columns of cards and a column of your recent activity, with when they were last fetched beside the refresh button, in formats you set, fetched every five minutes (not each time a tab opens) and kept through a rate limit; Media has a tab per player, the cover, controls and lyrics side by side when there's room, lyrics that follow the song until you scroll them, and a click on a line to play from there. Tabs of your own come from `~/.config/caelestia-tab/components`.
- The line under a bookmark takes the colour that goes with the tile's, one of your own, or none.
- Sites of your own: type a name in *Settings*, *Websites* and press Enter, then give it its domains, a selector and your CSS.
- A page font (*Settings*, *General*), and fonts for the clock's time and date. Font fields autocomplete from the installed fonts, listed by the helper, each shown in its own face. Font sizes are in pt.
- Tree Style Tab's sidebar takes the background's choices and fields: a colour dimmed towards the surface, the wallpaper dimmed and blurred, or TST's own look.
- Settings only show a field when it applies: a colour when the source is a colour, a blur when it's the wallpaper.
- Secrets by alias in `~/.config/caelestia-tab/secrets.toml`: from SOPS (nested keys), a command, a file or the environment. Values never reach the extension.
- The helper takes commands from the extension, for tabs that control something on the machine.
- The helper runs on tokio, each plugin in a task of its own, so a media command no longer waits behind GitHub's searches or a lyrics lookup.
- Your own components, from `~/.config/caelestia-tab/components`, built into the extension with ours; a `Ct` name is refused. They reach ours through `$ct`, and can use Tailwind, plain CSS or SCSS.
- Data for the menu's tabs from the helper: every MPRIS player (the Spotify app, mpv, a browser) with its year, cover and controls; lyrics from LRCLIB, timed where it has them and kept on disk, so a track is looked up once; and GitHub searches, with a token found without setup (`gh`, git's credential helper or the environment), cached with ETags, and kept in the helper.
- Settings are kept in `~/.config/caelestia-tab/settings.json` as well, so they survive a browser restart dropping a temporary add-on's storage, and can be edited by hand or kept in dotfiles; a hand edit reaches open tabs live.
- Nerd Font glyphs as a bookmark's mark. The symbols font is bundled, and the editor shows every glyph with a search by name, and suggests glyphs from the bookmark's address and name.
- Zen's window follows the scheme live. The helper writes a Zen mod into every Zen profile, and `zen/caelestia-tab.cfg` (installed with `caelestia-tab install-zen`, or `lib.wrapZen` on Nix) reloads it on each change.
- The clock sits on the same glass as the bookmarks, so it stays legible over any wallpaper, dark text in light mode included.
- Tree Style Tab's sidebar is tinted towards the scheme's primary and follows switches live. It can be turned off, and its strength set, in *Settings*, *Browser*.
- Site themes: the 134 catppuccin/userstyles, compiled against the live scheme and injected per site. Every page also gets the scheme as `--caelestia-*` CSS variables and a `caelestia-scheme` event, for your own Stylus styles and userscripts.
- Per-site overrides in *Settings*, *Websites*: more domains for a style, a CSS selector that applies it to matching pages wherever they're hosted, and your own CSS on top. The docs carry recipes for mdBook on any domain and for claude.ai's current design.

[Unreleased]: https://git.hu-tao.dev/hutao/caelestia-tab/compare/v0.1.1...main
[0.1.1]: https://git.hu-tao.dev/hutao/caelestia-tab/compare/v0.1.0...v0.1.1
[0.1.0]: https://git.hu-tao.dev/hutao/caelestia-tab/releases/tag/v0.1.0
