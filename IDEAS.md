# caelestia-tab ideas

A custom new tab for Firefox and its forks (Floorp, LibreWolf, Zen and so on)
and Chromium browsers (Chrome, Brave and so on) that follows the caelestia
colour scheme. It's meant for a broad audience, not one setup.

## Philosophy: everything is a plugin

- The core only loads plugins, config, secrets and styles, and passes events
  between them.
- The page itself is fixed (a bar, the clock, the bookmarks), not a platform
  of widgets: what's extensible is the menu's tabs, the shipped ones
  included. (Decided 2026-09-27, after a user-defined grid of placeable
  widgets proved a source of stray states.)
- The config lets anyone declare:
  - which plugins to load;
  - their own plugin code;
  - their own styles;
  - the secrets each plugin uses.
- Predefined component types (tile, list, card, media controls, and so on), and
  custom reusable components can be declared too.
- Done well, it could become part of caelestia shell, or at least earn stars.

## Scope and packaging

- Works in Firefox and its forks, not just Floorp, and in Chromium browsers.
  One Manifest V3 codebase; the differences are the background script
  (`service_worker` for Chrome, `scripts` for Firefox), a Chrome manifest for
  the helper, and publishing (the Chrome Web Store charges a one-time $5, AMO
  is free).
- Independent of nixos-dotfiles: it reads what caelestia writes,
  `~/.local/state/caelestia/scheme.json` and `wallpaper/path.txt`.
- Not NixOS-specific. The core logic doesn't depend on Nix, so it can also
  ship as a `.deb` and a PKGBUILD.
- A flake to build it, plus Nix files only for registering the helper or
  service on NixOS and Home Manager.
- The live browser theme is already covered by
  [CaelestiaFox](https://addons.mozilla.org/en-US/firefox/addon/caelestiafox),
  so this is the new tab only.

## Constraints

- Plugin code can't run in the extension. Manifest V3 only runs code shipped
  in the package, `eval` is blocked, and both stores reject remote code. So:
  - plugin logic runs in the helper, which can reload a plugin when its file
    changes;
  - the page gets only data, declarative components and CSS;
  - secrets stay in the helper, where SOPS decrypts them.
- The browser window frame is out of scope. CaelestiaFox already recolours
  Firefox's live, and it's the smallest thing that does that job.
- Chrome's window frame can't change live: Chrome has no runtime theme API.
  That's an upstream limitation, so we don't touch it. If you switch colours
  often, set a neutral Chrome theme.
- Extensions can't run on the browser's own pages (`about:`, `chrome://`, AMO,
  the Chrome Web Store), so those are never themed.

What updates live, with no reload:

- The new tab's colours, background, settings, clock and date.
- Themed websites through the CSS variables, including iframes and shadow DOM;
  userscripts through the event.
- Tree Style Tab, by re-sending its style.
- Media controls (MPRIS signals) and mail (IMAP IDLE).
- Git hosts, weather and status checks, on a poll rather than a push: a local
  machine gets no webhooks, and GitHub rate-limits.

Once, at install:

- Tabs already open don't have the page script yet. The extension injects it
  into them on install, or they need one reload.
- The browser may need a restart to find the helper the first time.

## Credentials

- All secrets go through SOPS.

## First milestone: prove colours and background

Built in the first prototype (2026-09-27): the helper and its data plugins,
the live colours and wallpaper, the clock and bookmark plugins with the grid
editor, device-local settings, and the Catppuccin site themes compiled against
the live scheme. See the handbook. Since then: a Tree Style Tab tint towards
primary (optional), and Nerd Font glyphs on bookmarks. Chrome support comes
next.

- The core and plugin loading.
- The new tab's colours and background follow the scheme and change live on a
  switch.
- Default plugins: clock and date, and bookmark tiles with custom icons.
- Settings on the new tab's own settings page, not in a rebuild: device-local,
  not synced, and they persist across reboots.

## Default plugins (after the milestone)

- Git hosting: open PRs, issues and review requests.
  - GitHub out of the box: built, as the menu's GitHub tab.
  - Custom providers configurable: Forgejo (and Gitea), GitLab, Bitbucket.
- Mail: recent and unread, over IMAP.
- Weather.
- Media controls for a configurable service, Spotify by default: built, as
  the menu's Media tab, for every MPRIS player.
- Music servers, with Navidrome as the reference.
- Status checks: an Uptime Kuma plugin as the generic reference.

## Themed websites

- A page-theming plugin puts the live scheme on every page as CSS variables
  (`--caelestia-primary`, `--caelestia-surface`, and so on) and fires an event
  when it changes.
- Stylus styles use the variables, so a site's look follows the scheme and
  changes live on a switch. For example, YouTube in caelestia colours.
- Userscripts listen for the event.
- Stylus and Violentmonkey need no API from us: the pages carry the colours.
- It needs permission to run on all sites, but only adds the variables and
  reads nothing from the page.
- Ship example styles, YouTube first.

### Catppuccin's userstyles, converted

- [catppuccin/userstyles](https://github.com/catppuccin/userstyles) themes 134
  sites and is MIT-licensed. Converted copies keep its copyright notice.
- caelestia's scheme already has all 26 Catppuccin colour names (`rosewater`
  through `crust`) for every scheme, so the palette maps one to one onto
  `--caelestia-*` variables.
- The styles are LESS and blend colours at compile time (`mix()`, `fade()`,
  `lighten()`), which needs concrete colours. A converter rewrites them to
  runtime CSS, which works on `var()` in Firefox 113+ and Chrome 111+:
  - `mix(@a, @b, 30%)` becomes `color-mix(in srgb, var(--caelestia-a) 30%,
    var(--caelestia-b))`;
  - `fade(@c, 50%)` becomes relative colour syntax,
    `rgb(from var(--caelestia-c) r g b / 50%)`;
  - `lighten` and `darken` become `hsl(from ... h s calc(l ± n))`.
- The flavour choice goes away: dark or light comes from the scheme's mode, so
  `if(@flavor = latte, ...)` becomes a mode switch.
- The accent option maps to a scheme colour, `primary` by default.
- Fallback for anything the converter can't rewrite: the helper compiles the
  LESS with concrete colours on every switch, like a caelestia template.
- The result is live: one conversion, and every switch recolours all the
  converted sites through the variables.
- Open: serve them through the page-theming plugin, export them as UserCSS for
  Stylus, or both.

## Example plugins (show how to write your own)

- My VPS status, built on the Uptime Kuma plugin.
- Tree Style Tab sidebar background. Not everyone uses Tree Style Tab, so it
  comes late or ships as an example plugin. Its settings:
  - background: the caelestia wallpaper, primary, secondary or tertiary, or
    don't touch Tree Style Tab at all;
  - position: set by hand, never overridden.

## More plugin ideas

- Forgejo CI status and pending Renovate PRs.
- How old `flake.lock` is, and whether an input is ahead of the lock.
- Today's calendar and tasks.
- Syncthing status.
- Bookmark icons tinted with the scheme.

## Open questions

- Check whether Firefox and the forks load an unsigned extension or need AMO
  unlisted signing, before building anything.
- Helper language: settled, Rust.
- Settled: a native-messaging helper, no open port.
- Music servers: WebDAV only serves files; the API most music servers share is
  Subsonic's (Navidrome, Gonic, Airsonic). Decide which to build on.
- Media controls:
  - MPRIS is the Linux standard for controlling any running player, Spotify's
    desktop app included.
  - Spotify's Web API needs Premium to control playback.
  - Audio played inside the tab stops when the tab closes, so the plugin should
    control a player that stays running.
- Mail: plain IMAP needs no server changes; the password comes from SOPS.
