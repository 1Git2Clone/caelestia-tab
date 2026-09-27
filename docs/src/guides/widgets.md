# The widgets

Every widget is a component placed on the page's grid (see
[The new tab](../architecture/newtab.md#the-page)). Add one from *Settings*,
*General*, *Add a widget*: it goes on the page with its editor open beside it.
After that, a widget is edited from the page: turn on the pen and pick it for
its properties, its placement, whether it shows, or to remove it.

## Toolbar

The pen, the settings button and each shown widget's own buttons (the
bookmarks' +). Each group can be turned off. Without a toolbar on the page,
Ctrl+, still opens settings. It's drawn above the other widgets, and edit
mode's outlines and pens above everything, so a widget placed over its area
(a menu across the top, say) never hides them. Such a widget can find it at
`.ct-toolbar` to keep its own buttons clear of it.

## Clock and date

The time and the date, each with its own separator, size (in pt) and font.
12- or 24-hour, a leading zero on the hour, seconds, four date styles, and the
glass behind it can be turned off.

## Bookmarks

Tiles on a CSS grid you define, or in even rows. See
[The new tab](../architecture/newtab.md#bookmarks).

## Data for your own widgets

caelestia-tab's own widgets are the three above. The rest is data the helper
gathers for widgets you write (see
[Writing a component](plugins.md#your-own-components)); a widget reads it from
`app.data[topic]` and asks for it with `tell({ topic, command, … })`:

- **`media`**: every MPRIS player on the session bus (the Spotify app, mpv,
  Firefox's own media …), with its title, artist, album, year, cover, length
  and position, and the controls: `PlayPause`, `Play`, `Pause`, `Next`,
  `Previous` and `SetPosition`, and nothing else on the bus. MPRIS doesn't
  announce the position as it moves, so each player carries the position
  with the time it was read (`at`) and its `rate`, for a widget to move it on
  itself. Spotify's app is known to report no position; checked with
  Firefox's media only.
- **`lyrics`**: a track's lyrics from [LRCLIB](https://lrclib.net), after a
  widget sends `{ command: "get", artist, title, album, seconds }`, timed
  (`synced: [{ ms, text }]`) when LRCLIB has them, plain otherwise, or
  `none`. The artist, title and album go to lrclib.net, and only when a widget
  asks. Some players send lyrics themselves (`lyrics` on the player).
- **`github`**: GitHub searches, after a widget sends
  `{ command: "queries", widget: id, queries }` (its own list, replacing its
  last one). The helper runs every widget's every 90 seconds and on
  `{ command: "refresh" }`, and an unchanged result comes back as a `304`,
  which doesn't count against GitHub's rate limit. Every open tab reads the
  same results from storage, so ten open tabs make no more requests than one.

A menu down the left of the page, with a GitHub feed and a player with its
lyrics, is one such widget: see
[Your own components](plugins.md#your-own-components).

### GitHub's token

No setup, if you use `gh` or git with GitHub already. The helper takes the
first token it finds:

1. The `github` secret alias (below).
2. `GH_TOKEN` or `GITHUB_TOKEN`, in the browser's environment.
3. `gh auth token`, if you're logged in with the GitHub CLI.
4. git's credential helper for `github.com`, with prompts turned off, so a
   helper that would ask (a terminal prompt, Git Credential Manager's window)
   answers nothing instead of popping up.

The token never leaves the helper: the extension gets the search results and
where the token came from, nothing else. Checked on 2026-09-27 with a `gh`
login; the other three are unconfirmed.

## Secrets

Secrets live outside the browser and are named by alias in
`~/.config/caelestia-tab/secrets.toml`. The file holds no values, only where
each one is:

```toml
[github]
sops = "~/secrets/secrets.yaml"   # decrypted with `sops -d`
key = "github.token"              # nested keys, dot-separated; tokens.0 indexes a list

[weather]
command = "pass show weather"     # the first line of its output

[other]
env = "OTHER_TOKEN"               # or: file = "~/.config/other/token"
```

A plugin asks for an alias when it needs the value; the helper resolves it
then and keeps the value in memory only. No page, snapshot or
`storage.local` ever sees one. For SOPS, `sops` has to be on the browser's
`PATH` and able to reach its key (age, GPG …) the way it does from a
terminal.
