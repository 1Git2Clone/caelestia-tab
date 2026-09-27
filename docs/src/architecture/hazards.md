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
- **The Chrome DevTools MCP can't find Chrome on NixOS**; it looks in
  `/opt/google/chrome`. To look at the new tab outside a browser, serve
  `extension/` with a stub `browser` object and screenshot it with
  `google-chrome-stable --headless=new --screenshot` (2026-09-27).
