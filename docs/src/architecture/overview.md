# How the pieces talk

```text
caelestia CLI ──writes──▶ ~/.local/state/caelestia/{scheme.json, wallpaper/path.txt}
                                   │ inotify
                                   ▼
                         caelestia-tab (helper)
                                   │ native messaging (stdio)
                                   ▼
                         background.js ──writes──▶ storage.local
                                   ▲                  │ onChanged
                     "theme?"      │                  ├──▶ newtab.js (every open new tab)
                     insertCSS     │                  └──▶ content.js (every page)
                                   └───────────────────────┘
```

- **The helper** is the only part that reads the machine. It sends each data
  plugin's value when it starts and again when a watched file changes, if the
  value differs from what it last sent.
- **The background page** writes those values into `storage.local` as they
  arrive, and does nothing else with them. It also compiles site themes on
  request.
- **The new tab and the content scripts** read `storage.local` and listen for
  changes. They never talk to the helper, and a background page that has been
  suspended and restarted loses nothing they need.

Storage is the one channel, for the helper's data and for settings alike. That
makes every open new tab stay in step with every other: a bookmark edited in
one appears in the rest, the same way a scheme switch does.

## Why storage and not messages

Firefox suspends a Manifest V3 background page when it's idle. Anything held
only in its memory, or sent only as a message to it, is lost when that
happens. `storage.local` persists, and it wakes every listener on change, so a
new tab opened while the background sleeps still has the last scheme and
wallpaper at once.

An open new tab holds a `runtime.connect` port to the background, which keeps
the background, and with it the helper, running while there's a tab that
wants live updates.

## Why the helper and not the extension

A browser extension can't read files from disk, and neither store accepts one
that runs code it didn't ship. So the helper does the reading, and the
extension gets data, never code.
