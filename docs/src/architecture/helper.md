# The helper

`caelestia-tab` is a native messaging host: the browser starts it when the
extension calls `connectNative("caelestia_tab")`, and talks to it over stdin
and stdout.

## Data plugins

Each data plugin implements `plugins::Plugin`:

```rust
pub trait Plugin {
    fn topic(&self) -> &'static str;                       // the storage.local key its value goes to
    fn read(&self) -> io::Result<Value>;                   // the current value
    fn watches(&self) -> Vec<PathBuf> { … }                // files whose changes mean "read again"
    fn start(&self, wake: Wake) {}                         // a timer or signal source of its own
    fn command(&self, message: &Value) -> io::Result<()>   // a message from the extension
    fn changed(&self, value: &Value) {}                    // after a new value was sent
}
```

These ship today:

| Topic | Reads | Value | Updates |
| --- | --- | --- | --- |
| `scheme` | `$XDG_STATE_HOME/caelestia/scheme.json` | the file as caelestia wrote it: `name`, `flavour`, `mode`, `variant`, `colours` (hex without `#`) | the file changes |
| `wallpaper` | `$XDG_STATE_HOME/caelestia/wallpaper/path.txt`, then the image it names | `{ path, url }`, where `url` is a `data:` URL of the image | the file changes |
| `fonts` | `fc-list : family` | the installed font families, sorted | once, at start |
| `github` | GitHub's search API, with the token from the chain in [The widgets](../guides/widgets.md#the-token) | `{ results: { query: { total, items } }, auth, error? }` | every 90 s, and on a command |
| `savedSettings` | `$XDG_CONFIG_HOME/caelestia-tab/settings.json` | `{ settings, mtime }`; a `save` command writes it | the file changes |
| `media` | every MPRIS player on the session bus | `{ players: [{ player, identity, status, title, artist, art, length, position, at, … }] }` | a player's properties change, it seeks, or a player comes or goes |

`XDG_STATE_HOME` defaults to `~/.local/state`, as it does for caelestia.

To add one: a new file in `src/plugins/`, an entry in `plugins::all()`, and the
extension reads `storage.local[topic]`. A plugin that needs a secret asks
`secrets::get(alias)` (`src/secrets.rs`); the value stays in the helper.

## Commands

The extension can send a plugin a message, `{ topic, command, … }`: a widget
calls `tell()` (`store.svelte.ts`), the background passes it to the helper
over the native messaging port, and the host hands it to that topic's
plugin's `command`. The plugin's value is read again straight after, so the
effect shows without waiting. The GitHub widget sends its searches this way;
the media widget, its controls. A plugin decides what it accepts: `media`
takes only the player methods it names, so the extension can't reach
anything else on the bus through it.

A plugin can also implement `changed(&value)`, which runs after a new value
was sent. The scheme plugin uses it to write the Zen mod (`src/zen.rs`; see
[Zen's window](../guides/zen.md)).

## Waking

All of a plugin's reasons to be read again arrive on one channel: a watched
file's event, a command, or `Event::Refresh(topic)` from the plugin's own
thread, which `start` sets up (`github`'s timer, `media`'s D-Bus signals).
The host reads plugins one at a time, so a slow read (a GitHub search) holds
up the others for its length.

## Watching

The helper watches each watched file's parent directory, not the file itself.
caelestia replaces files by renaming a new one over them, and a watch on the
old file would never see a change. Watching the directory also covers a file
that doesn't exist yet.

On any event naming a watched file, the plugin's value is read again and sent
only if it differs from the last one sent. That makes duplicate events, and
writes that leave the content as it was, free. A half-written file fails to
parse, is logged, and the write that finishes it sends the value.

## The wire format

Each message is a 4-byte native-endian length followed by that much UTF-8
JSON, the browser's native messaging framing:

```json
{ "topic": "scheme", "value": { … } }
```

Browsers refuse a single message from the host over 1 MiB, and a wallpaper is
usually bigger. A message over 512 KiB is sent as parts instead:

```json
{ "part": 0, "parts": 4, "data": "{\"topic\":\"wallpaper\",\"val" }
```

The parts arrive in order; `background.ts` concatenates their `data` and
parses the result as one message. `host::tests` checks that parts rejoin
exactly, including a multi-byte character straddling a boundary.

## Lifetime

The helper exits when stdin closes, which is how the browser says the
extension disconnected. It keeps no state between runs, so each start sends
everything again.

## The manifest

`caelestia-tab manifest` prints it; `install` writes it for each browser (see
[Browsers](../guides/browsers.md)). The host name uses an underscore because
native messaging doesn't allow hyphens in it, and `allowed_extensions` must
match the extension's `gecko.id`, `caelestia-tab@hu-tao.dev`.
