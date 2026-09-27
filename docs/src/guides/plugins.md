# Writing a component

A widget on the new tab is a Svelte component that also exports `widget`: its
label, its defaults, and the fields its settings take. The settings panel
draws a form from those fields, and what the user sets arrives as the
component's `settings` prop. The clock (`extension/src/components/widgets/CtClock.svelte`)
is a complete example.

```svelte
<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";

  export const widget: WidgetInfo = {
    label: "Hello",                       // shown in Settings, Widgets
    defaults: { who: "world", loud: false },
    fields: [                             // the form Settings draws for it
      { key: "who", label: "Greet", type: "text" },
      { key: "loud", label: "Shout", type: "checkbox" },
    ],
    place: { justify: "center" },         // optional: where a new one sits on the page
  };
</script>

<script lang="ts">
  let { settings, editing }: { settings: any; editing: boolean } = $props();
</script>

<p class="ct-hello rounded-2xl bg-glass p-4 text-on-surface">
  Hello, {settings.loud ? settings.who.toUpperCase() : settings.who}
</p>
```

Put it in your components folder (see
[Your own components](#your-own-components)), build, and add it from
*Settings*, *General*, *Add a widget*. It's then edited from the page, with the
pen. The same goes for a widget of caelestia-tab's own, in
`extension/src/components/widgets/`.

## What a component gets

- `settings`: this widget's settings, `defaults` filled in with what's saved.
  It's live state: assign to it (`settings.who = "you"`) and the change is
  saved, and every open tab shows it. There's no save call.
- `editing`: whether the pen button is on. Offer rearranging and editing then.
- The whole app state, `getContext<App>("ct")` (see
  [The new tab](../architecture/newtab.md#state)), for opening an editor in
  the side panel: `edit(app, title, component, props)` from
  `store.svelte.ts`. The editor gets an `onclose` prop. There are no pop-ups:
  an editor changes the widget's settings directly, so the page shows it
  live.

## Fields

`extension/src/fields.ts` lists the field types: `checkbox`, `text`, `url`,
`number`, `textarea`, `select`, `range`, `colour` (a scheme colour or a fixed
one), `font` (a font-family, with the installed fonts offered), `image` (a URL
or an upload), `glyph` (a Nerd Font glyph, with
suggestions for the words its `words(values)` returns) and `presets` (buttons
that set several keys at once). Any field can take `when: (values) => boolean`
to show only when it applies, like a colour only when the source is a colour.
`CtForm` draws them, bound to an object, and works inside your own components
too.

## Edit mode

With the pen on, `editing` is true and the widget gets an overlay. The default
one (`CtEditOverlay`) opens the widget's fields and placement. Set
`widget.overlay` to a component of your own (it gets `{ widget, app }`), or to
`false` for none, when the widget edits itself in place.

## Actions

`widget.actions` puts buttons in the toolbar while the widget is shown:
`{ icon, title, run(settings, app) }`. The bookmarks' + is one.

## Colours and style

The `Ct*` components use Tailwind utilities only, and the scheme is
Tailwind's palette: `bg-primary`, `text-on-surface`, `border-outline-variant`,
`bg-glass` for the frosted panels. They follow the scheme live. Outside
Tailwind the same colours are `var(--caelestia-primary)` and so on. `scheme.ts`
exports `COLOURS` (the colours offered in pickers), `cssColour(token)` and
`onColour(token)` (the text colour for a background colour).

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

Every `.svelte` file there is compiled with ours. One that exports `widget` is
a widget, offered in *Settings*, *General*, *Add a widget*; the rest are
components your widgets import (`import Marquee from "./Marquee.svelte"`).
They reach ours through `$ct`: `$ct/fields.ts`, `$ct/store.svelte.ts` (`tell`,
`edit`, the `App` type), `$ct/components/CtIcon.svelte` and so on. Style them
however you like: Tailwind's classes and the scheme's colours work in them (the
build scans the folder), and so do `<style>`, `lang="scss"` and plain CSS.

A widget whose component isn't in a build, because it was built without your
folder, keeps its settings: it just doesn't show, except as a placeholder in
edit mode, where it can be removed.

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
