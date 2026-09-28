# Development

Everything runs from the dev shell, which carries Rust, mdBook, web-ext and
Node:

```sh
nix develop
sh scripts/setup-hooks.sh   # once per clone: the pre-commit hook
```

## The layout

```text
.
├── src/                    # the helper (Rust)
│   ├── main.rs             # the CLI: install, uninstall, manifest, or run as the host
│   ├── host.rs             # native messaging: framing, parts, file watching
│   ├── install.rs          # where each browser looks for the manifest
│   ├── zen.rs              # the Zen mod, and install-zen
│   └── plugins/            # data plugins: scheme, wallpaper
├── extension/              # the extension: Svelte 5 and TypeScript, built with Vite
│   ├── newtab.html         # the new tab's page; Vite's entry
│   ├── src/
│   │   ├── newtab.ts       # mounts App with the state from store.svelte.ts
│   │   ├── store.svelte.ts # settings, scheme and wallpaper; saving and syncing
│   │   ├── app.css         # the only global CSS: scheme variables, font, Tailwind
│   │   ├── components/     # Ct* components; widgets/ holds the widgets
│   │   ├── fields.ts       # the settings API: field types, WidgetInfo
│   │   ├── widgets.ts      # finds every widget component
│   │   ├── layout.ts       # even rows, window-edge detection
│   │   ├── background.ts   # helper connection, site theme injection
│   │   ├── render.ts       # the new tab for svelte/server
│   │   ├── scheme.ts       # the scheme as CSS variables, colour tokens
│   │   ├── userstyles.ts   # compile a style, split and match @-moz-document
│   │   ├── treestyletab.ts # the Tree Style Tab sidebar
│   │   └── glyphs.ts       # Nerd Font glyph suggestions and search
│   ├── public/             # copied into dist/ as they are
│   │   ├── manifest.json
│   │   ├── content.js      # per page: asks for its theme, keeps what it got
│   │   ├── userstyles/     # vendored catppuccin/userstyles + index.json
│   │   └── vendor/         # vendored less.js and the Nerd Fonts symbols
│   └── dist/               # the built extension (not committed)
├── zen/                    # Zen's autoconfig: the pref file and the watcher script
├── scripts/vendor-userstyles.mjs   # refreshes extension/public/userstyles and less.js
├── scripts/vendor-nerd-fonts.sh    # refreshes extension/public/vendor/nerd-fonts
├── tests/                  # node --test for userstyles, glyphs and layout, and the Firefox tests
└── docs/                   # this handbook
```

## Checks

The pre-commit hook and CI run the same things:

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
node --test tests/*.test.mjs
npm ci --prefix extension          # once, and when package-lock.json changes
npm run --prefix extension check   # svelte-check: TypeScript and Svelte
npm run --prefix extension build   # extension/dist
web-ext lint --source-dir extension/dist --self-hosted
```

`node --test` runs the TypeScript sources directly; Node strips the types.

And, slower, the whole path in a real headless Firefox. The pre-push hook runs
it; CI doesn't, because the runner has no home directory and nixpkgs' Firefox
wrapper won't build without one:

```sh
cargo build
nix shell nixpkgs#firefox nixpkgs#geckodriver -c node tests/e2e-firefox.mjs
```

It runs Firefox under a throwaway `HOME` and `XDG_STATE_HOME`, so it never
touches your browser or your caelestia state. It checks that the new tab
override loads, the helper's scheme and wallpaper arrive, a scheme file renamed
into place reaches the open tab live, and a matching page gets the variables and
its compiled Catppuccin style.

How fast a new tab is, the same way, with your wallpaper, scheme and settings
(copied into the throwaway `HOME`):

```sh
nix shell nixpkgs#firefox nixpkgs#geckodriver -c node tests/newtab-speed.mjs
```

It opens a few new tabs and prints, for each, when the page's script ran, its
state loaded, it mounted, the wallpaper was ready and it first painted, in ms
from navigation. The page sets those as `performance` marks (`ct-start`,
`ct-state`, `ct-mounted`, `ct-wallpaper`), so the same numbers come from any
browser's console on a new tab:

```js
Object.fromEntries([...performance.getEntriesByType("mark"), ...performance.getEntriesByType("paint")].map((e) => [e.name, Math.round(e.startTime)]))
```

The UI has Playwright tests (`extension/tests/newtab.spec.ts`), run by the
pre-push hook and CI:

```sh
npm run --prefix extension build && npm run --prefix extension test
```

They drive the built new tab like a user: the pen opening a widget in the
side panel and editing it live, a bookmark's tile and the panel's title
following its name, glyph suggestions following the name, adding and
removing a widget, fields that only show when they apply, Escape, and edits
surviving a reload. Any uncaught error on the page fails a test. A new
interaction gets a test.

Playwright can't install an add-on into Firefox (it does extensions in
Chromium only), so these load `dist/newtab.html` as a page, served by
`vite preview`, with the extension API stood in by
`extension/tests/browser-shim.js`: storage in `localStorage`, no helper. What
needs the real extension (the helper, storage between pages, site injection)
is the e2e test's. The browsers come from nixpkgs (`PLAYWRIGHT_BROWSERS_PATH`
in the dev shell), and `@playwright/test` is pinned to the same version;
bump both together.

To check the site styles themselves against the live sites, which takes about
ten minutes and needs the network, run this by hand after vendoring a new
catppuccin/userstyles revision:

```sh
nix shell nixpkgs#firefox nixpkgs#geckodriver -c node tests/sites-firefox.mjs          # all of them
nix shell nixpkgs#firefox nixpkgs#geckodriver -c node tests/sites-firefox.mjs github   # just these
```

It prints each site as themed or not and lists the ones to look at by hand;
[Site themes](../architecture/site-themes.md#checking-the-styles) says why a
failure there isn't always a broken style.

`web-ext lint` warns about `new Function` and `innerHTML` in
`vendor/less.min.js`, which are less.js's JavaScript-evaluation and plugin
features that no bundled style uses, and about `innerHTML` in `newtab.js` and
`render.js`, which is how Svelte's runtime builds DOM from its compiled
templates. Warnings don't fail the build, errors do.

## Running it in a browser

```sh
cargo build && ./target/debug/caelestia-tab install   # or wherever your target dir is
npx --prefix extension vite build --watch &            # rebuilds dist/ on every save
web-ext run --source-dir extension/dist --firefox=floorp   # any Firefox-based binary
```

`web-ext run` starts a throwaway profile with the extension loaded, and
reloads it when `dist/` changes. `install` points the manifest at the debug
binary, so run it again after switching back to an installed build.

The helper can be driven by hand as well. It writes length-prefixed JSON to
stdout and exits when stdin closes:

```sh
(sleep 1) | caelestia-tab | head -c 300
XDG_STATE_HOME=/tmp/fake caelestia-tab   # point it at a fake caelestia state
```

## Refreshing the Catppuccin styles

```sh
node scripts/vendor-userstyles.mjs
```

It fetches catppuccin/userstyles at the commit pinned in the script (`REV`),
compiles each style once to find its URL rules, and rewrites
`extension/public/userstyles/` and `extension/public/vendor/`. Bump `REV` to update, run it,
then run `node --test tests/*.test.mjs`. A style that stops compiling is
skipped with a warning, not dropped silently.

## Refreshing the Nerd Fonts symbols

```sh
sh scripts/vendor-nerd-fonts.sh
```

It downloads the symbols-only font of the release pinned in the script
(`VERSION`), converts it to WOFF2 (about 1 MB instead of 2.4), and writes a
name-to-codepoint index of every glyph for the editor's suggestions.

## The handbook

```sh
mdbook serve docs    # live preview
mdbook build docs    # what the pages workflow does
```

The pages workflow publishes `main` to
<https://pages.hu-tao.dev/hutao/caelestia-tab/docs/>.

## Releasing

Date the `[Unreleased]` section of `CHANGELOG.md`, bump `version` in
`extension/public/manifest.json` and `Cargo.toml`, commit, and tag it
`v<version>`. Then, with the tag checked out:

```sh
nix shell nixpkgs#zip -c scripts/release-zip.sh <version>
```

It builds the extension without anyone's own components (a normal build
takes in `~/.config/caelestia-tab/components`), leaves out `render.js`, which
nothing loads yet, and writes `release/caelestia-tab-<version>.zip`, the
source zip and `SHA256SUMS`. The zips are byte for byte the same on every run
and every machine with the same lockfile: every file takes the tagged
commit's time, and they're zipped sorted, since `web-ext build` stamps entries
with the time it zips and adds them in any order. For 0.1.0:

```
ad84678028036c27ec41c98405a5950a8f892dce8670e53fd0ba19f53662b781  caelestia-tab-0.1.0.zip
2a114cd8d37bc8c0dc590029ee5373a4cca42c3516143368ec02acd484b588f3  caelestia-tab-0.1.0-source.zip
```

AMO asks for the source of bundled, minified code: the second zip, built as
with the script (Node 24, npm 11). Its linter warns about `vendor/less.min.js`
(less.js, unmodified, from `scripts/vendor-userstyles.mjs`), the
`innerHTML` in Svelte's runtime and the page's `<style>`s, and
`data_collection_permissions` being newer than the minimum Firefox; none is
an error.
