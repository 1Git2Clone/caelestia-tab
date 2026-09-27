# Introduction

caelestia-tab is a browser extension, plus a small Rust helper, for people who
run the [caelestia](https://github.com/caelestia-dots) desktop. It gives you:

- a new tab whose colours and background follow caelestia's current scheme and
  wallpaper, and change live when you switch;
- bookmarks on a grid you define yourself, with images or solid scheme colours;
- the [catppuccin/userstyles](https://github.com/catppuccin/userstyles) site
  themes (134 sites), recoloured with the live scheme instead of a Catppuccin
  flavour;
- the scheme on every page as `--caelestia-*` CSS variables, for your own
  Stylus styles and userscripts.

It works in Firefox and Firefox-based browsers (Floorp, Zen, LibreWolf,
Waterfox). The browser's own window frame is out of scope:
[CaelestiaFox](https://addons.mozilla.org/en-US/firefox/addon/caelestiafox)
already recolours that, and the two work side by side.

Everything on the new tab is a plugin, the built-in widgets included.
[IDEAS.md](https://git.hu-tao.dev/hutao/caelestia-tab/src/branch/main/IDEAS.md)
holds the plans for what comes next.
