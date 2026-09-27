# The new tab

`newtab.js` is the core. It loads `settings` from `storage.local`, applies the
scheme and wallpaper, and mounts one plugin per widget. It knows nothing about
clocks or bookmarks.

## Settings

One object under `storage.local.settings`:

```js
{
  background: { source: "wallpaper" | "colour" | "none", colour, dim, blur },
  widgets: [ { id, plugin, hidden?, settings }, … ],  // page order
  sites: { enabled, off: [styleId, …], accent },      // site themes
  css: "",                                            // custom CSS for the new tab
}
```

A widget is an instance of a plugin, so the same plugin can appear twice with
different settings. A widget's `settings` are merged over its plugin's
`defaults` when it's mounted, so a plugin that gains a setting needs no
migration.

Settings are local to the device: `storage.local`, not `storage.sync`. They
survive restarts and don't depend on a rebuild or any file on disk. *Settings*,
*Advanced*, *All settings* shows the whole object as JSON, to back up, copy to
another machine, or edit by hand.

## Rendering

Any change to `settings` in storage re-mounts every widget, in every open new
tab. A plugin's `save` only writes storage; the redraw is the storage change
coming back. The core keeps its own object when the change coming back is its
own write, so an open settings dialog keeps editing the same object.

A scheme change doesn't re-mount anything. The scheme is a `<style>` of
`--caelestia-*` variables, which the core replaces; everything styled with the
variables follows.

The wallpaper arrives as a `data:` URL, which the core turns into a blob URL
once, so the page's style doesn't carry a copy of the image as text.

## Bookmarks

The bookmarks plugin lays tiles out on a CSS grid whose `grid-template-columns`,
`grid-auto-rows`, `gap` and `grid-auto-flow` are settings, typed as CSS. The
Tiles and List presets only fill those fields in. A tile takes `span <width>`
and `span <height>`, or any `grid-column` and `grid-row` value, which override
the spans. A value the browser can't parse is dropped by the browser, so a
half-typed setting leaves the grid as it was.

A tile shows its image, or a solid scheme colour when it has none. The text on
it uses the colour's matching "on" colour (`onPrimary` on `primary`, and so
on). Uploaded images are stored in settings as `data:` URLs, which is why the
extension asks for `unlimitedStorage`.

The pen button turns on edit mode. Each tile gets a bar to move it earlier or
later, drag it (HTML drag and drop, dropping on another tile's position), edit
it, or remove it.
