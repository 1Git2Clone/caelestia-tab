# Writing a plugin

A widget on the new tab is a plugin: an ES module in `extension/plugins/`
whose default export describes it, listed in `extension/plugins/index.js`. The
clock and the bookmarks are plugins like any other; read
`extension/plugins/clock.js` for the smallest complete one.

```js
export default {
  id: "hello",                 // stored in settings.widgets[].plugin
  name: "Hello",               // shown in Settings, Widgets
  defaults: { who: "world" },  // this widget's settings before any are saved
  settings: [                  // the form Settings renders for it
    { key: "who", label: "Greet", type: "text" },
  ],
  actions: [                   // optional toolbar buttons
    { icon: "add", title: "Say it louder", run: (ctx) => ctx.save({ ...ctx.settings, who: ctx.settings.who.toUpperCase() }) },
  ],
  mount(el, ctx) {             // draw into el; return a cleanup function or nothing
    el.textContent = `Hello, ${ctx.settings.who}`;
  },
};
```

Then add it to `plugins/index.js`, and add a widget to show it, from
*Settings*, *Advanced*, *All settings*:

```json
{ "id": "hello", "plugin": "hello", "settings": {} }
```

## What `mount` gets

`ctx` holds:

- `settings`: this widget's settings, `defaults` merged with what's saved.
- `editing`: whether the pen button is on. Offer rearranging and editing then.
- `save(next)`: store `next` as this widget's settings. Don't redraw after it:
  the new tab re-mounts every widget when settings change, in every open tab,
  so the redraw after a save is the same one another tab's change gets.
- `ui`: the core's building blocks, so a plugin never imports the core.
  - `ui.dialog({ title, tabs, aside, onSave })` opens the modal. Each tab is
    `{ label, render() }`, returning an element. With `onSave`, it has Cancel
    and Save, and stays open if `onSave` returns `false`.
  - `ui.form(fields, values, update)` renders `fields` against `values` and
    calls `update(patch)` as they change, after assigning the patch into
    `values`. The field types are listed in `extension/ui.js`: `checkbox`,
    `text`, `url`, `number`, `textarea`, `select`, `range`, `colour` (a scheme
    colour), `image` (a URL or an upload) and `presets`.
  - `ui.el(tag, props, ...children)` and `ui.icon(name)`.

`mount` runs again on every settings change and every edit-mode toggle, so
keep it cheap and return a cleanup for anything that outlives the element (a
timer, a listener).

## Colours

Use the scheme's CSS variables, `var(--caelestia-primary)`,
`var(--caelestia-surface-container)` and the rest. They change live, so a
plugin that styles with them never needs to watch the scheme. `scheme.js`
exports `COLOURS` (the colours offered in pickers), `cssColour(token)` and
`onColour(token)` (the text colour for a background colour).

## Style

Put a plugin's CSS in `newtab.css` under `.widget-<id>`, the class its
section gets.

## Plugins that need data from outside the browser

A web page can't read files or keep secrets, and the stores reject extensions
that run downloaded code. So anything that reads the machine (files, D-Bus,
passwords) belongs in the helper as a data plugin: implement the `Plugin`
trait in `src/plugins/`, and list it in `plugins::all()`. Its value lands in
`storage.local` under its topic, where the new tab can read it and watch for
changes. See [The helper](../architecture/helper.md).
