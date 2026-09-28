# The page and its tabs

The page is fixed: a bar along the top with the menu button, the menu's tabs
and the toolbar; the clock under it; and the bookmarks at the bottom. Open the
menu and its tab covers the clock (see
[The new tab](../architecture/newtab.md#the-page)). Everything is edited from
the page: turn on the pen and pick a part (the toolbar, the clock, the
bookmarks, or the open tab) for its settings in the side panel.

## Toolbar

The bookmarks' +, the pen and the settings button, each of which can be
turned off, and which side of the bar it sits on (the menu's tabs take the
other). Without the settings button, Ctrl+, still opens settings.

## Clock and date

The time and the date, each with its own separator, size (in pt) and font.
12- or 24-hour, a leading zero on the hour, seconds, four date styles, and the
glass behind it can be turned off.

## Bookmarks

Tiles on a CSS grid you define, or in even rows, each with a line under it in
the colour that goes with the tile's, one of your own, or none. See
[The new tab](../architecture/newtab.md#bookmarks).

## The menu's tabs

Open or closed, and the tab it's on, stay as you left them, in every new tab.
Tabs of your own come after these (see [Writing a menu tab](plugins.md)).

- **GitHub**: each of your searches (one per line, `Label: query`) as a
  column of compact cards, and your recent activity (pushes, pull requests,
  reviews, comments …) where a line's query is `@activity`, as in
  `Recent activity: @activity`. A repeated query is one column, and a line
  with a label but no query yet is skipped. A push reads *Pushed 16bdf70 to
  main* and links to that commit. With *Private activity* off, every column is
  public repositories only: each search is sent with `is:public`, and the
  activity column is GitHub's own list of your public events (so it's your last
  public ones, not your last 30 filtered down to nothing). The helper keeps
  both twins of every search for an hour and both lists of events, so flipping
  it back and forth shows the other at once and doesn't ask GitHub again. The
  refresh button spins until the helper answers, and gives up after
  15 seconds if nothing changed (while rate-limited, say). Beside it, when the
  helper last fetched them, as
  *Updated at 22:31*, *Updated at yesterday, 22:31* or
  *Updated at 26-09-2026 22:31*: the words and the three formats are settings.
- **Media**: a tab per player at the top (four a row, two on a narrow page,
  the last row's sharing the whole width), then the one picked, or the one
  playing: its cover, title, album and artist, year and controls, and the
  lyrics beside them when there's room, under them when there isn't. The
  cover's size and its column's width are settings. Timed lyrics follow the
  song and a line clicked plays from there; scroll them yourself and they stop
  following until you've stopped with the current line in view. Lyrics
  without times say so.

## The helper's data

The tabs read what the helper gathers from `app.data[topic]`, and ask for it
with `tell({ topic, command, … })`. A tab of your own can too:

- **`media`**: every MPRIS player on the session bus (the Spotify app, mpv,
  Firefox's own media …), with its title, artist, album, year, cover, length
  and position, and the controls: `PlayPause`, `Play`, `Pause`, `Next`,
  `Previous` and `SetPosition`, and nothing else on the bus. MPRIS doesn't
  announce the position as it moves, so each player carries the position
  with the time it was read (`at`) and its `rate`, for a tab to move it on
  itself. Checked with Firefox's media and the Spotify app.
- **`lyrics`**: a track's lyrics from [LRCLIB](https://lrclib.net), after a
  tab sends `{ command: "get", artist, title, album, seconds }`, timed
  (`synced: [{ ms, text }]`) when LRCLIB has them, plain otherwise, or  `none`. The artist, title and album go to lrclib.net, and only when a tab
  asks, and once a track: lyrics found are kept in
  `~/.cache/caelestia-tab/lyrics/`. Some players send lyrics themselves (`lyrics` on the player).
- **`github`**: GitHub searches, and your recent events when asked, after a
  tab sends `{ command: "queries", widget: id, queries, activity, private }`
  (its own list, replacing its last one). The tab adds `is:public` to its
  queries itself; `private: false` asks for `publicActivity` rather than
  `activity`. `results` holds every search kept, asked for now or in the last
  hour, each with its ETag. The helper fetches them every five minutes,
  on `{ command: "refresh" }` and when a search is new, side by side, and
  otherwise answers from what it last fetched, so opening a tab doesn't
  search again: GitHub allows 30 searches a minute. An unchanged result comes
  back as a `304`. Rate-limited, it keeps what it had, says so
  (`error`, `limitedUntil`) and waits for GitHub's reset. Every open tab
  reads the same results from storage, so ten open tabs make no more requests
  than one.

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
