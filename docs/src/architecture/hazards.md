# Known hazards

Things that look wrong, or look safe, and aren't. Dated where they were learned
the hard way.

- **The native host name can't contain a hyphen.** It's `caelestia_tab`, while
  the binary is `caelestia-tab`. Both `install.rs` and `background.js` spell it;
  change both or neither.
- **`allowed_extensions` must match `gecko.id` exactly.** A mismatch looks
  like a missing helper: "No such native application".
- **Watch directories, not files** (see [The helper](helper.md#watching)).
  caelestia renames new files into place, which a file watch misses.
- **One native message can't exceed 1 MiB.** Anything bigger is sent in parts;
  don't add a plugin that bypasses `host::frames`.
- **`element.dataset = {…}` throws** in the new tab (ES modules are strict and
  `dataset` has no setter). Set `node.dataset.x` after creating the node.
  Caught in review of the Websites tab, 2026-09-27.
- **less.js's browser build needs a `document`.** It reads
  `document.currentScript` when loaded, so it can't run in Node or a Chrome
  service worker. Firefox's background page has one, and it compiles there
  (checked with the e2e test). The vendoring script uses the npm build of the
  same version instead (2026-09-27).
- **`@-moz-document` preludes can contain `{`** inside a `regexp()`, e.g.
  pinterest's `[a-z]{2}`. Parse the rules one by one; don't cut the prelude at
  the first brace (2026-09-27).
- **A regexp rule's value is a CSS string.** `"\\."` in the style is `\.` to
  the regex, and a bare `\.` is just `.`. `userstyles.js` unescapes it the CSS
  way before building the `RegExp`.
- **WebDriver won't navigate to `moz-extension://` URLs.** To reach the new
  tab in a test, start geckodriver with `--allow-system-access` and call
  `BrowserCommands.openTab()` from the chrome context, which also exercises the
  override itself. See `tests/e2e-firefox.mjs` (2026-09-27).
- **A leftover geckodriver answers for the next test run.** An interrupted run
  can leave one listening, with the old run's `HOME` and state, and the next
  run silently drives it and watches the wrong files. The e2e test refuses to
  start if its port is taken (2026-09-27).
- **Port 8384 may be a real Syncthing.** Syncthing's style matches it, which
  makes it tempting as a test site; the e2e test uses InvokeAI's 9090
  instead (2026-09-27).
- **Some upstream styles have rules that never match.** InvokeAI's nests its
  `:root` rules inside `:root`, compiling to `:root :root`. Check the compiled
  CSS before blaming the injection (2026-09-27).
- **`--start-url about:newtab` shows the browser's own new tab**, not the
  extension's. The override applies to tabs opened as new tabs (Ctrl+T), so
  open one to test it (2026-09-27).
- **A fresh Zen profile shows a welcome screen and no new tab page.** Pass
  `--pref zen.welcome-screen.seen=true --pref zen.urlbar.replace-newtab=false`
  to `web-ext run` (2026-09-27).
- **Testing against a real profile:** `web-ext run --firefox-profile <dir>`
  runs a temporary copy, next to the running browser, and deletes it on exit.
  The copy restores the session and extensions like Tab Session Manager, so
  the start URL may open behind other tabs (2026-09-27).
- **TST paints its sidebar with `--browser-background` first.** It's set
  inline from the browser theme, so overriding only `--tabbar-bg` changes
  nothing whenever a theme is active; `treestyletab.js` overrides both, with
  `!important` (2026-09-27).
- **A starting TST sidebar drops registrations.** It replaces its list of
  extensions with a snapshot it asked TST's background for, so a
  `register-self` that lands in between is lost. `background.js` re-sends once,
  5 seconds after the first registration, and on every `sidebar-show`
  (2026-09-27).
- **TST sends `ready` only to extensions it already knows.** The first
  registration has to be retried until TST answers, not wait for `ready`.
- **Check TST's sidebar in a test by opening it as a tab**:
  `moz-extension://<uuid>/sidebar/sidebar.html`, with the UUID pinned through
  `extensions.webextensions.uuids`. The real sidebar runs in another process,
  and the chrome context can't read its document (2026-09-27).
- **Zen ignores `browser.theme`.** Neither caelestia-tab nor CaelestiaFox
  can colour Zen's window through it; `src/zen.rs` writes a Zen mod instead
  (2026-09-27).
- **Zen sets its background gradient inline on `#zen-browser-background`.**
  A `:root` override loses to it there, because custom properties inherit and
  the element's own value wins; the mod targets that element too, and the
  `-old` variables Zen crossfades from (2026-09-27).
- **Zen only reloads mods when `zen.mods.updated-value-observer` flips.**
  Rewriting the CSS alone changes nothing until a restart (2026-09-27).
- **Autoconfig has three traps.** zen-browser-flake's wrapper symlinks the
  binary, so the wrapper's `mozilla.cfg` never runs; the default sandbox gives
  the script `pref()` and nothing else (no `Components`, no `Services`); and
  the script runs before a profile exists, so anything touching the profile
  waits for `final-ui-startup`. `lib.wrapZen` and `zen/caelestia-tab.cfg`
  handle all three (2026-09-27).
- **Firefox caches a temporary add-on's files.** Reloading the page after
  editing the extension's CSS shows the old CSS; restart `web-ext run`
  (started with `--no-reload`) to see the change (2026-09-27).
- **The Forgejo runner has no home directory.** Building nixpkgs' Firefox
  there fails with "home directory /homeless-shelter exists", so the
  end-to-end test runs from the pre-push hook instead of CI (2026-09-27).
- **The Chrome DevTools MCP can't find Chrome on NixOS**; it looks in
  `/opt/google/chrome`. To look at the new tab outside a browser, serve
  `extension/` with a stub `browser` object and screenshot it with
  `google-chrome-stable --headless=new --screenshot` (2026-09-27).
