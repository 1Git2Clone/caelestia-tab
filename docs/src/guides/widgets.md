# The widgets

Every widget is a component placed on the page's grid (see
[The new tab](../architecture/newtab.md#the-page)). Add one from *Settings*,
*Widgets*, *Add*, then put it in an area with its *Placement*, or with the pen.

## Toolbar

The pen, the settings button and each shown widget's own buttons (the
bookmarks' +). Each group can be turned off. Without a toolbar on the page,
Ctrl+, still opens settings.

## Clock and date

The time and the date, each with its own separator, size (in pt) and font.
12- or 24-hour, a leading zero on the hour, seconds, four date styles, and the
glass behind it can be turned off.

## Bookmarks

Tiles on a CSS grid you define, or in even rows. See
[The new tab](../architecture/newtab.md#bookmarks).

## Media

What a media player is playing, with its cover, progress and controls:
previous, play or pause, next, and a click on the progress bar to seek. It
works with any player that speaks MPRIS on the session bus: the Spotify app,
mpv, Firefox's own media, and so on. *Prefer* picks a player by part of its
name (`spotify`); without a match, it shows whichever is playing.

The helper's `media` plugin reads the players over D-Bus and runs the
commands; nothing but play, pause, next, previous and seek is reachable
through it. MPRIS doesn't announce the position as it moves, so the widget
moves it on itself between updates. Spotify's app is known to report no
position over MPRIS, which would leave its progress bar at the start; checked
on 2026-09-27 with Firefox's media only, so that's unconfirmed here.

## GitHub

Your pull requests and issues, as GitHub searches: one per line, as
`Label: query` in GitHub's search syntax. The defaults are your open pull
requests (`is:open is:pr author:@me`), the ones waiting for your review
(`review-requested:@me`) and the issues assigned to you. The helper runs the
searches every 90 seconds and whenever you press refresh; an unchanged result
comes back as a `304`, which doesn't count against GitHub's rate limit. Every
open tab reads the same results from storage, so ten open tabs make no more
requests than one.

### The token

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
