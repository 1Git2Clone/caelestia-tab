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
├── extension/              # the extension, plain ES modules with no build step
│   ├── manifest.json
│   ├── background.js       # helper connection, site theme injection
│   ├── content.js          # per page: asks for its theme, keeps what it got
│   ├── newtab.{html,css,js}  # the new tab's core
│   ├── ui.js               # dialog and forms, handed to plugins
│   ├── scheme.js           # the scheme as CSS variables, colour tokens
│   ├── userstyles.js       # compile a style, split and match @-moz-document
│   ├── treestyletab.js     # the Tree Style Tab tint
│   ├── glyphs.js           # Nerd Font glyph suggestions and parsing
│   ├── plugins/            # widgets: clock, bookmarks
│   ├── userstyles/         # vendored catppuccin/userstyles + index.json
│   └── vendor/             # vendored less.js and the Nerd Fonts symbols
├── zen/                    # Zen's autoconfig: the pref file and the watcher script
├── scripts/vendor-userstyles.mjs   # refreshes extension/userstyles and less.js
├── scripts/vendor-nerd-fonts.sh    # refreshes extension/vendor/nerd-fonts
├── tests/                  # node --test for userstyles.js and glyphs.js, and the Firefox e2e test
└── docs/                   # this handbook
```

## Checks

The pre-commit hook and CI run the same things:

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
node --test tests/*.test.mjs
web-ext lint --source-dir extension --self-hosted
```

And, slower, the whole path in a real headless Firefox (CI's `nix` job runs it
too):

```sh
cargo build
nix shell nixpkgs#firefox nixpkgs#geckodriver -c node tests/e2e-firefox.mjs
```

It runs Firefox under a throwaway `HOME` and `XDG_STATE_HOME`, so it never
touches your browser or your caelestia state. It checks that the new tab
override loads, the helper's scheme and wallpaper arrive, a scheme file renamed
into place reaches the open tab live, and a matching page gets the variables and
its compiled Catppuccin style.

`web-ext lint` warns about `new Function` and `innerHTML` in
`vendor/less.min.js`; those are less.js's JavaScript-evaluation and plugin
features, which no bundled style uses. Warnings don't fail the build, errors
do.

## Running it in a browser

```sh
cargo build && ./target/debug/caelestia-tab install   # or wherever your target dir is
web-ext run --source-dir extension --firefox=floorp   # any Firefox-based binary
```

`web-ext run` starts a throwaway profile with the extension loaded, and
reloads it when a file changes. `install` points the manifest at the debug
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
`extension/userstyles/` and `extension/vendor/`. Bump `REV` to update, run it,
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
