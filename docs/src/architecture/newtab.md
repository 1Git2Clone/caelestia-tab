# The new tab

The new tab is a Svelte 5 app (`extension/src/`), built with Vite into
`extension/dist/`. `App.svelte` is the root; everything under it is a `Ct*`
component, styled with Tailwind utilities and nothing else (see
[Styling](#styling)).

## State

`store.svelte.ts` holds the whole state as one `$state` object, handed to
every component through Svelte's context (`getContext("ct")`):

```ts
{
  settings,     // what's saved, below
  scheme,       // the helper's scheme, or null
  helperError,  // why there's no helper, or null
  wallpaper,    // a blob: URL of the caelestia wallpaper, or null
  editing,      // the pen button
  panel,        // the settings panel is open
  dialog,       // the open modal: { component, props }, or null
}
```

The settings are one object under `storage.local.settings`:

```ts
{
  background: { source: "wallpaper" | "colour" | "none", colour, dim, blur },
  widgets: [ { id, component, hidden?, settings }, … ],  // page order
  sites: { enabled, off: [styleId, …], accent, overrides },
  treeStyleTab: { tint, strength },
  css: "",                                               // custom CSS for the new tab
}
```

A widget is an instance of a component (`CtClock`, `CtBookmarks`, or one of
yours), so the same component can appear twice with different settings. When
settings load, each widget's `settings` are filled in from its component's
`defaults`, so a component that gains a setting needs no migration. Settings
saved before the Svelte rewrite name a `plugin` (`clock`, `bookmarks`), which
is mapped to the component on load.

Settings are local to the device: `storage.local`, not `storage.sync`.
*Settings*, *Advanced*, *All settings* shows the whole object as JSON, to back
up, copy to another machine, or edit by hand.

## Saving and syncing

Components change `app.settings` directly; nothing calls a save. An effect
watches the settings and writes them to storage whenever they change, and
every open tab's `storage.onChanged` listener takes other tabs' writes.

A tab also hears its own writes come back, and not always in order: a slider
writes on every step, and an early step's echo can arrive after a later step
was written. Taken for another tab's change, it would roll the value back. So
each tab remembers what it wrote and ignores those echoes (`pending` in
`store.svelte.ts`).

A scheme change touches nothing but a `<style>` of `--caelestia-*` variables
in the head; everything styled with them follows.

The wallpaper arrives as a `data:` URL, which the store turns into a blob URL
once, so the page's style doesn't carry a copy of the image as text.

## Settings

The settings are a panel docked to the window's right edge, not a modal: the
page moves over to stay in view beside it, so a change shows as it's made.
The bookmark editor is a modal (`CtDialog`), because it edits a copy and
applies it on Save.

A widget's form is drawn from its component's `fields` (see
[Writing a component](../guides/plugins.md)): the settings panel knows nothing
about clocks or bookmarks.

## Styling

The page's only global CSS is `src/app.css`: the `--caelestia-*` variables with
fallbacks for before the helper answers, the bundled symbols font, form
controls inheriting the page's font, and Tailwind's utilities without its
reset. Tailwind's colours are the scheme's (`bg-primary`, `text-on-surface`,
`border-outline-variant` …), declared with `@theme inline`, so every utility
follows the live scheme. Tailwind's own palette is left out.

The `Ct*` components use Tailwind classes only. A value only known at run time
(a setting, the wallpaper) goes in as a CSS variable read by a class:
`style:--dim={…}` with `opacity-(--dim)`.

Each component also carries a stable `ct-*` class (`ct-tile`, `ct-clock`,
`ct-bookmarks` …) for your custom CSS to target.

A widget's wrapper gets `ct-edge-top`, `-bottom`, `-left` and `-right` while
it touches that edge of the window (`edges` in `layout.ts`, rechecked on
resize and zoom). A widget squares its corners there with
`in-[.ct-edge-bottom]:rounded-b-none`.

## Bookmarks

`CtBookmarks` lays tiles out on a CSS grid whose `grid-template-columns`,
`grid-auto-rows`, `gap` and `grid-auto-flow` are settings, typed as CSS. The
Tiles and List presets only fill those fields in. A tile takes `span <width>`
and `span <height>`, or any `grid-column` and `grid-row` value, which override
the spans. A value the browser can't parse is dropped, so a half-typed
setting leaves the grid as it was.

With *Even rows* on (the Tiles default), the columns come from the narrowest
tile width instead: as many as fit, then as few as still need that many rows,
so five tiles that don't fit on one row go 3 and 2, never 4 and 1
(`evenColumns` in `layout.ts`, tested in `tests/extension.test.mjs`).

A tile shows its image, or its colour when it has none: a scheme colour, which
follows the scheme, or a fixed one from the browser's colour picker. Text on a
scheme colour uses its "on" colour (`onPrimary` on `primary`); on a fixed one,
black or white, whichever reads better. Uploaded images are scaled to 512 px
and stored in settings as WebP `data:` URLs, which is why the extension asks
for `unlimitedStorage`.

A tile's mark is either up to a few letters (an emoji works) or a Nerd Font
glyph, from the vendored symbols-only font. The glyph field is a search over
every glyph, showing all of them until you type; above them, it suggests
glyphs from the bookmark's address and name. The host's labels, without `www`
and the TLD, and the name's words are matched against the 11 000 glyph names:
a whole-word match (`fa-github`) ranks above a word inside a longer name
(`dev-githubactions`). `glyphs.ts` does the matching.

The pen button turns on edit mode. Each tile gets a bar under its content to
move it earlier or later, drag it (HTML drag and drop, dropping on another
tile's position), edit it, or remove it.

## Clock

`CtClock` shows the time and the date, each with its own separator and size.
The hour can be 12- or 24-hour, with or without a leading zero; the date comes
in four styles. Its sizes shrink with a narrow window instead of overflowing
it. It renders no time until it's mounted, since a copy of the page rendered
ahead of time can be hours old.
