# caelestia-tab ideas

A custom new tab for Firefox and its forks (Floorp, LibreWolf, Zen and so on)
and Chromium browsers (Chrome, Brave and so on) that follows the caelestia
colour scheme. It's meant for a broad audience, not one setup.

## Philosophy: everything is a plugin

- The core only loads plugins, config, secrets and styles, and passes events
  between them.
- Every widget is a plugin, including the built-in ones, which are just default
  plugins.
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

## Credentials

- All secrets go through SOPS.

## First milestone: prove colours and background

- The core and plugin loading.
- The new tab's colours and background follow the scheme and change live on a
  switch.
- Default plugins: clock and date, and bookmark tiles with custom icons.
- Settings on the new tab's own settings page, not in a rebuild: device-local,
  not synced, and they persist across reboots.

## Default plugins (after the milestone)

- Git hosting: open PRs, issues and review requests.
  - GitHub out of the box.
  - Custom providers configurable: Forgejo (and Gitea), GitLab, Bitbucket.
- Mail: recent and unread, over IMAP.
- Weather.
- Media controls for a configurable service, Spotify by default.
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
- Helper language: Rust or Python.
- A native-messaging helper (no open port) or a localhost service.
- Music servers: WebDAV only serves files; the API most music servers share is
  Subsonic's (Navidrome, Gonic, Airsonic). Decide which to build on.
- Media controls:
  - MPRIS is the Linux standard for controlling any running player, Spotify's
    desktop app included.
  - Spotify's Web API needs Premium to control playback.
  - Audio played inside the tab stops when the tab closes, so the plugin should
    control a player that stays running.
- Mail: plain IMAP needs no server changes; the password comes from SOPS.
