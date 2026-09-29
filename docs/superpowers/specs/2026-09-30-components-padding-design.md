# Page padding, pen boxes, hiding and the Components section

Approved 2026-09-30. One branch, `feat/components-padding`, one commit per
section (A–F), each with its docs and CHANGELOG entry.

## A. Page padding

- `settings.padding = { tied: true, x: 2.5, y: 2.5 }`, rem. `complete()` fills
  it in for older settings.
- Settings › General: a checkbox *Same on every side* (`tied`); tied, one
  *Padding* range bound to `x`; untied, *Horizontal* (`x`) and *Vertical*
  (`y`). Two fields on `x` with exclusive `when`s; no new form code.
  Range 0–6rem, step 0.25.
- `CtLayout`'s `main` takes the padding through CSS variables: `x` left and
  right, `y` (or `x` when tied) top and bottom. Today's `px-10 pt-4` goes.
- Docked bookmarks (E) ignore the bottom padding: they stay flush with the
  window's bottom edge.

## B. Pen boxes

- `CtEditOverlay` draws its outline inside the part (negative offset) so
  `overflow-hidden` (the menu panel) and the window's edges (the bookmarks)
  no longer clip a side.
- The menu gets its own pen box: `CtMenu` exports a `widget` (label *Menu*),
  settings at `settings.menu`. Collapsed, the box is around the menu button;
  open, around the whole panel, with its chip outside the panel's clipping.
  The open tab keeps its own box, starting under the bar.

## C. Hiding

- The rule: a component that exports `widget` or `tab` (fields.ts) is
  placeable, and hideable. One that exports neither is a building block (the
  "abstract" kind): no pen, no hide, not listed. No new flag.
- Each placeable's settings get `hidden: false`. `CtPartEditor` appends a
  *Hide* checkbox as the last field of every form, so no component (ours or a
  user's) implements it.
- The toolbar's *Hide* has a hint: Ctrl+, opens Settings without it.
- Hidden menu: no button, no panel; the clock stays. Hidden menu and toolbar:
  no bar at all.
- A hidden tab is off the bar; if it was open, the first visible tab opens.
- `widgets.ts` exports one list of placeables (clock, toolbar, bookmarks,
  menu, each tab: name, label, info, where its settings are), used by the
  layout and the Components section.

## D. Settings › Components

- The panel's second tab (General, Components, Background, …).
- Two groups: ours (Ct*) and yours (user components that are menu tabs).
- A row: label and a visibility toggle; hidden rows greyed. The toggle
  flips `hidden`; the rest of the row opens the component's settings, the
  pen's form (`edit(app, …, CtPartEditor, …)`).
- No user components: the group says where they go
  (`~/.config/caelestia-tab/components/`) and the build command. No *+* yet
  (see IDEAS.md, plugins).

## E. Bookmarks

Fields, in order:

1. *Start from* presets, updated to the fields below.
2. *Flow*: a two-way switch, Rows | Columns, both dense
   (`grid-flow-row-dense` / `grid-flow-col-dense`). A new field type,
   `switch`, with two `[value, label]` options, drawn as a segmented control.
3. *Columns* / *Rows*: a number (default 4), labelled by the flow. Row flow:
   `grid-template-columns: repeat(n, minmax(0, 1fr))`. Column flow:
   `grid-template-rows: repeat(n, <row height>)`, columns
   `grid-auto-columns: minmax(0, 1fr)`.
4. *Row height*: rem (default 8.75).
5. *Gap*: rem (default 1.25).
6. *Placement*: switch, Floating (default) | Docked. Floating: rounded all
   round, the page's bottom padding under it. Docked: flush with the bottom,
   square bottom corners, as today.
7. *Hide* (C).

- Both placements keep the 4px primary top border; its top corners are
  rounded like the menu's (`rounded-2xl`, the same radius), and the border
  follows the curve.
- Gone: *Even rows*, *Narrowest tile*, `evenColumns` in layout.ts and its
  test, and the probe that measured the tile width.
- Migration in `complete()`: `columns` `repeat(N, …)` → N; `rows` and `gap`
  `"<n>rem"` → n; `flow` `row*` → `row`, `column*` → `column`; `even` and
  `tileWidth` dropped. Anything that doesn't parse gets the default.
- The defaults keep at least one generic bookmark (today's four stay).

## F. No bookmarks, a taller menu

When the bookmarks are hidden, or have no items and edit mode is off, they
aren't drawn and the menu (open, or the clock under a closed one) fills the
page. In edit mode an empty bookmarks part still shows, for its pen box.

## Docs

- `docs/src/guides/widgets.md`: padding, the menu's pen box, hiding, the
  Components section, the new bookmark fields and placement.
- `docs/src/guides/plugins.md`: a user tab is hideable for free; components
  that export neither `widget` nor `tab` are building blocks.
- `CHANGELOG.md` under `[Unreleased]`.
- `IDEAS.md`: the plugin system (a library for autocomplete on our
  components, user components in their own git repos, a Plugins section that
  imports repos, a rebuild button), and an in-browser editor for components
  and CSS with autocomplete on the scheme's variables.

## Testing

- `node --test`: the bookmarks migration (each old shape → numbers, junk →
  defaults), and the placeables list (a module with neither export isn't in
  it).
- The Playwright spec (`extension/tests/newtab.spec.ts`): hiding a part from
  the Components section removes it from the page and greys its row; the
  menu fills the page with the bookmarks hidden.
- Pre-commit (fmt, clippy, node tests, svelte-check, build, web-ext lint).
