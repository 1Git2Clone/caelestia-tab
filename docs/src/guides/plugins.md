# Writing a menu tab

The page itself is fixed (the bar, the clock, the bookmarks); what you add to
it is a tab in the menu. A tab is a Svelte component that also exports `tab`:
its label, a Nerd Font glyph for its button, its defaults, and the fields its
settings take. With the pen on, the open tab's chip opens a form drawn from
those fields in the side panel, and what the user sets arrives as the
component's `settings` prop. The Media tab
(`extension/src/components/tabs/CtMedia.svelte`) is a complete example.

```svelte
<script module lang="ts">
  import type { TabInfo } from "$ct/fields.ts";

  export const tab: TabInfo = {
    label: "Hello",                       // its button on the menu's bar
    glyph: "\uf256",                      // nf-fa-hand_paper_o
    defaults: { who: "world", loud: false },
    fields: [                             // the form the pen opens for it
      { key: "who", label: "Greet", type: "text" },
      { key: "loud", label: "Shout", type: "checkbox" },
    ],
  };
</script>

<script lang="ts">
  let { settings }: { settings: any } = $props();
</script>

<p class="ct-hello rounded-2xl bg-glass p-4 text-on-surface">
  Hello, {settings.loud ? settings.who.toUpperCase() : settings.who}
</p>
```

Put it in your components folder (see
[Your own components](#your-own-components)) and build: it's a tab after
caelestia-tab's own (GitHub, Media), in the order of the file names. The
clock, the toolbar and the bookmarks take the same `fields` (their `widget`
export), which is how the pen edits them too.

## What a tab gets

- `settings`: this tab's settings, `defaults` filled in with what's saved,
  under `menu.tabs.<ComponentName>`. It's live state: assign to it
  (`settings.who = "you"`) and the change is saved, and every open tab shows
  it. There's no save call.
- The whole app state, `getContext<App>("ct")` (see
  [The new tab](../architecture/newtab.md#state)): the helper's data in
  `app.data`, `tell()` for a command to a helper plugin, and
  `edit(app, title, component, props)` from `store.svelte.ts` for an editor of
  your own in the side panel. The editor gets an `onclose` prop. There are no
  pop-ups: an editor changes the settings directly, so the page shows it live.

The tab fills the panel under the bar and scrolls when it's taller; a
`h-full` root can divide the height itself, as Media does.

## Fields

`extension/src/fields.ts` lists the field types: `checkbox`, `text`, `url`,
`number`, `textarea`, `select`, `range`, `colour` (a scheme colour or a fixed
one), `font` (a font-family, with the installed fonts offered), `image` (a URL
or an upload), `glyph` (a Nerd Font glyph, with
suggestions for the words its `words(values)` returns), `presets` (buttons
that set several keys at once) and `screen` (a full-width row that opens
another component in the side panel, over this one, with `back` here).
Any field can take `when: (values) => boolean`
to show only when it applies, like a colour only when the source is a colour.
`CtForm` draws them, bound to an object, and works inside your own components
too.

## Colours and style

The `Ct*` components use Tailwind utilities only, and the scheme is
Tailwind's palette: `bg-primary`, `text-on-surface`, `border-outline-variant`,
`bg-glass` for the frosted panels. They follow the scheme live. Outside
Tailwind the same colours are `var(--caelestia-primary)` and so on. `scheme.ts`
exports `COLOURS` (the colours offered in pickers), `cssColour(token)`,
`onColour(token)` (the text colour for a background colour) and
`complement(token)` (the accent that goes with it, as under a bookmark).

Font sizes are in `pt`, everything else in `rem`. Give the root element a
`ct-<name>` class, so custom CSS can find it, and square the corners that
meet a window edge with
`in-[.ct-edge-bottom]:rounded-b-none` and its siblings.

## Your own components

Yours go in `~/.config/caelestia-tab/components/` (or wherever
`CAELESTIA_TAB_COMPONENTS` points), and the next build takes them in:

```sh
npm run --prefix extension build
```

Every `.svelte` file there is compiled with ours. One that exports `tab` is a
menu tab, and gets Hide for free, last in its own pen, like every part of the
page; once built in, it's also a row under *Yours* in Settings › Components,
next to caelestia-tab's own. The rest are components your tabs import
(`import Card from "./Card.svelte"`); a component that exports neither
`widget` nor `tab` is a building block for others, with no pen, no Hide and no
row in Settings › Components.
They reach ours through `$ct`: `$ct/fields.ts`, `$ct/store.svelte.ts` (`tell`,
`edit`, the `App` type), `$ct/components/CtIcon.svelte`,
`$ct/components/CtMarquee.svelte` and so on. Style them
however you like: Tailwind's classes and the scheme's colours work in them (the
build scans the folder), and so do `<style>`, `lang="scss"` and plain CSS.

A tab whose component isn't in a build, because it was built without your
folder, keeps its settings: it just isn't on the bar.

A build without that folder is a build without your components, so an
extension built elsewhere (or signed for a store) won't have them. They need a
build of your own, which an unsigned install accepts on Firefox Developer
Edition, Nightly and forks with signing off (see
[Installing](installing.md#the-extension)).

## The `Ct` prefix is reserved

Components whose names start with `Ct` are the project's, and the build
refuses a file of yours named that way, since it would stand in for one of
ours.

## Components that need data from outside the browser

A web page can't read files or keep secrets, and the stores reject extensions
that run downloaded code. So anything that reads the machine (files, D-Bus,
passwords) belongs in the helper as a data plugin: implement the `Plugin`
trait in `src/plugins/`, and list it in `plugins::all()`. Its value lands in
`storage.local` under its topic, where a component can read it and watch for
changes. See [The helper](../architecture/helper.md).
