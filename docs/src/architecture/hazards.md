# Known hazards

Things that look wrong, or look safe, and aren't. Dated where they were learned
the hard way.

- **The native host name can't contain a hyphen.** It's `caelestia_tab`, while
  the binary is `caelestia-tab`. Both `install.rs` and `background.ts` spell it;
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
  the regex, and a bare `\.` is just `.`. `userstyles.ts` unescapes it the CSS
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
  nothing whenever a theme is active; `treestyletab.ts` overrides both, with
  `!important` (2026-09-27).
- **A starting TST sidebar drops registrations.** It replaces its list of
  extensions with a snapshot it asked TST's background for, so a
  `register-self` that lands in between is lost. `background.ts` re-sends once,
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
- **The runner's job image is not a stdenv.** It carries nix, node, bash,
  coreutils, findutils, grep, sed, tar, gzip, xz, curl, git and which (the vps
  repo's `modules/runner/ci-image.nix`), and no awk, diff, make, patch,
  bzip2, unzip or jq. A `run:` step that works in your shell fails with exit
  127 there; run anything off that list through `nix develop -c`. The release
  workflow's first run died on awk this way (2026-09-28).
- **The Chrome DevTools MCP can't find Chrome on NixOS**; it looks in
  `/opt/google/chrome`. To look at the new tab outside a browser, serve
  `extension/` with a stub `browser` object and screenshot it with
  `google-chrome-stable --headless=new --screenshot` (2026-09-27).
- **`hidden` loses to any `display` rule.** An element with `display: flex`
  from a class stays visible with the `hidden` attribute set, which is why the
  *Filter sites* box did nothing. `newtab.css` has a global
  `[hidden] { display: none !important }` (2026-09-27).
- **A catppuccin style can compile, match and still change nothing.** The site
  moved on and the style sets variables it no longer reads. claude.ai's is the
  example: it sets `--bg-*`, Claude reads `--cds-*` (2026-09-27). Only looking
  at the page shows it; `tests/sites-firefox.mjs` does that for every style.
- **A style's domain list is not everywhere its site kind lives.** mdBook's
  lists a handful of Rust books, so an mdBook anywhere else is unthemed. That's
  what an override's *Also on pages matching* selector is for (2026-09-27).
- **Svelte 5 throws when a template changes state.** Creating a settings entry
  on the fly while rendering a list (a `??=` inside `{#each}`) stops the whole
  render with `state_unsafe_mutation`, and the panel silently keeps showing
  the previous tab. Create state in an event handler instead (the Websites
  list does it on `ontoggle`) (2026-09-27).
- **Unlayered CSS beats every Tailwind class.** Tailwind's utilities live in
  `@layer utilities`; a plain `button { font: inherit }` outside any layer wins
  over `font-glyph` on a button, which showed every glyph as a box. `app.css`
  keeps its rules in `@layer base`, declared before `utilities`
  (2026-09-27).
- **`vite build --ssr` pulls in `node:async_hooks`** through svelte/server's
  async rendering. It's only loaded for async renders and a failed load is
  caught, so the SSR build marks it external rather than polyfilling it
  (2026-09-27).
- **`playerctld` is on the bus as an MPRIS player too.** It stands in for
  whichever player is active, so listing every `org.mpris.MediaPlayer2.*`
  name shows that player twice. The media plugin skips it (2026-09-27).
- **The helper's GitHub token comes from the browser's environment.** `gh`
  reads its login from `$HOME`, so a browser started with another `HOME` (the
  e2e tests' throwaway one, a Flatpak) finds no token. `GH_TOKEN` in that
  environment works (2026-09-27).
- **A watched file's directory has to exist when the helper starts.** The host
  watches directories, and a watch on one that isn't there yet fails, so a
  file created there later is never seen. The settings plugin creates
  `~/.config/caelestia-tab/` at start for that reason (2026-09-27).
- **A widget spanning an `auto` grid row sizes that row.** The menu spans the
  toolbar's row and the clock's, and its content grew the toolbar's row,
  pushing the bookmarks off the screen whatever the middle row said. A widget
  that should fill its area and scroll takes `h-0 min-h-full`, so its content
  doesn't count towards the rows; a row that should shrink is
  `minmax(0, 1fr)`, not `1fr` (2026-09-27).
- **A running browser keeps its old helper after a rebuild.** Nix's browser
  wrappers link the helper's manifest into `~/.mozilla/native-messaging-hosts`
  when the browser starts, so a browser started before the rebuild still
  starts the old helper, and a plugin added since answers "a command for no
  plugin" or never sends. Restart the browser (2026-09-27). And check where
  the link points: one made by hand (`ln -s` to fix a stale one) stays as
  it is, and the wrapper leaves it alone, so a restart kept the old helper
  running; `readlink -f` it against the system's store path.
- **Reading a watched file raises an event about it.** inotify reports opens
  and closes too, which notify passes on as `EventKind::Access`. Reading the
  scheme again on those read it again, forever: 94,000 reads in 8 seconds,
  and every other plugin's value, a media command's included, queued behind
  them, arriving tens of seconds late with no error anywhere. The host
  ignores access events (2026-09-27).
- **Spotify sends `mpris:trackid` as a string.** MPRIS says an object path,
  and reading it as one gave Spotify no track, so `SetPosition` (which needs
  the track) could never be sent and a lyric click did nothing, silently. The
  media plugin takes either (2026-09-27).
- **An implicit grid column is `auto`, and grows to its content.** A grid
  with no `grid-template-columns` sizes its one column to the widest child,
  so a long line (a marquee's) pushed the Media tab's cover column past its
  cell instead of scrolling inside it. Give such grids
  `grid-cols-[minmax(0,1fr)]` (2026-09-27).
- **An effect that reads a derived object re-runs on every update.** Each
  helper value is a new object, so an effect meant for "a new song" that read
  `p?.track` through `p` ran on every position update and ended the lyrics'
  hold each time. Derive the primitive first (`const track = $derived(p?.track)`)
  and read that (2026-09-27).
- **A glyph is a button's accessible name.** A Nerd Font glyph is a
  private-use character, and as a button's only text it becomes its name,
  which no label or locator matches. Mark the glyph `aria-hidden="true"`
  and name the button (2026-09-27).
- **The helper's settings file has its keys sorted.** serde_json's maps are
  ordered, so the file comes back with the same settings as storage in a
  different order, and a `JSON.stringify` comparison called them changed.
  The background then wrote the file's copy back, the new tab replaced
  `app.settings` with it, and every open editor went on editing the old
  objects: a bookmark's colour changed once, then never again until a
  reload. Compare with `stable()` (`json.ts`), and give an editor a function
  that finds what it edits in `app.settings` each time (`App.focus.props`)
  (2026-09-27).
- **GitHub allows 30 searches a minute, and a tab mounts often.** The GitHub
  tab sent its searches on every mount (each new tab, each switch back to
  it), and the helper searched on every message: three searches each time,
  and a 403 within minutes. The helper fetches on its timer, on refresh and
  for a new search only, and answers from what it has otherwise
  (2026-09-27).
- **A transition on a component's root doesn't play when the parent's
  `{#if}` shows it.** Svelte 5 transitions are local by default: they play
  only for their own block. The settings panel, shown by App's `{#if}`,
  needs `transition:fly|global` (2026-09-27).
- **GitHub's events are the last 30 of every repository, private ones
  first when you're busy there.** Filtering them for `public` in the tab left
  nothing: all 30 were one private repository's. Public-only is GitHub's
  own list, `users/{login}/events/public`, fetched and cached beside the other
  (2026-09-28).
- **GitHub's push events no longer carry `size` or `commits`,** only `head`
  and `before`. Code reading `size` fell back to a bare *Pushed to main*; the
  tab shows `head`'s short SHA and links to that commit (2026-09-28).
- **The private toggle swaps every search for another query.** Dropping a
  search's results as soon as nothing asks for it meant each flip searched
  again, against GitHub's 30 a minute. The helper keeps a search an hour
  after it was last asked for, and sends all it keeps (2026-09-28).
- **The helper only sends what changed, so a command can get no answer.**
  A refresh while rate-limited fetches nothing and sends nothing. The tab's
  refresh spinner stops on the next value *or* after 15 seconds; anything
  else that waits on an answer needs the same way out (2026-09-28).
- **A Playwright test passes on data you made up.** The private toggle's
  first test seeded events with a `public` flag and passed, while the real
  tab, on the real list, showed nothing. For helper data, check what the
  helper really sends (drive the binary over native messaging, or the e2e
  harness with `GH_TOKEN` set) before writing the fixture (2026-09-28).
- **`/rate_limit`'s `core.used` stayed at 0 for `gh`'s token** through
  requests that should count, so it can't show whether the helper fetched.
  The helper's `at` moves on every fetch: watch that instead (2026-09-28).
- **The e2e harness's `js()` returns `"ERR …"` rather than throwing.** A
  script that throws (an element not found) reads as a result, and a step
  that didn't happen looks like it did. Compare what it returns
  (2026-09-28).
- **The browser runs the helper it started with.** After a rebuild, an open
  browser keeps the old helper, and a new tab that expects newer data waits
  for what never comes. The GitHub tab checks for the keys it needs and asks
  for a newer helper instead (2026-09-27).
- **The e2e test's `js()` returns an error instead of throwing.** A script
  that fails comes back as the string `"ERR …"`, so a setup step whose result
  isn't checked fails silently and the assertion after it looks like the
  feature's fault. Assert on a setup step's result (`null` when it returned
  nothing). Storage there holds only what's been changed, too: no `sites`
  until something set them (2026-09-27).
- **The release zips only build on Linux.** The flake has no macOS shell, and
  outside it `scripts/release-zip.sh` stops at BSD `touch`, which doesn't take
  `-d @<epoch>`. On a Mac, build in a `nixos/nix` container, and `docker cp`
  the checkout in: Docker Desktop doesn't share `/private/tmp`, so a mount of
  it comes up empty ("could not find a flake.nix"). An aarch64 container
  gives the same checksums as the x86_64 runner (2026-09-29).
- **Polling `getAnimations()` misses a short transition.** Settings' slides
  last 220ms, and on the loaded CI runner one can be over before
  `expect.poll` takes its first sample, so a test waiting for "an animation is
  running" reads 0 forever. Count `Element.prototype.animate` calls instead
  (Svelte's transitions go through it), as the Components slide test does.
  It failed main's CI after passing the PR's, the run v0.1.2 was first tagged
  on (2026-10-02).
- **Tag only once main's own CI is green.** The PR's checks don't stand in
  for the push run on the merge commit: a flaky test can pass one and fail
  the other, and the tag then has to move (2026-10-02).
