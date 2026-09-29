# Page padding, pen boxes, hiding and a Components section: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A padding setting for the page, pen boxes that aren't clipped (and one for the menu), a Hide option on every placeable component with a Components section in Settings to manage them, a simpler bookmarks grid that floats or docks, and a menu that fills the page when there are no bookmarks.

**Architecture:** The page is fixed (`CtLayout` → `CtMenu` with the toolbar and clock, then `CtBookmarks`). A component is *placeable* when it exports `widget` or `tab` (fields.ts); `widgets.ts` gathers them into one `placeables` list that the layout and the new Components section share. Hiding is a `hidden` key in a placeable's settings, with the Hide checkbox added by `CtPartEditor`, so no component implements it. The bookmarks' CSS-string settings become numbers, migrated by a pure `bookmarkOptions()` in a new `bookmarks.ts` (so node tests can import it).

**Tech Stack:** Svelte 5 (runes), TypeScript, Tailwind v4 (classes only, run-time values through CSS variables like `px-(--px)`), Vite, Playwright (Firefox) for UI tests, `node --test` for pure modules.

**Spec:** `docs/superpowers/specs/2026-09-30-components-padding-design.md`

## Global Constraints

- Repo: `~/Projects/caelestia-tab`, branch `feat/components-padding`. Don't switch branches, don't push.
- Styling: Tailwind classes only, no `<style>` blocks; a run-time value goes in as a CSS variable read by a class (AGENTS.md).
- Comments: the why, sparingly, in the file's own voice; never restate the code.
- Every commit updates its docs in the same commit: `docs/src/guides/widgets.md` (and `plugins.md` where noted), `CHANGELOG.md` under `## [Unreleased]` (`### Added` / `### Changed` / `### Removed`, one bullet per user-visible change, in the file's style: *Italic* setting names).
- Commit messages: `feat: …` / `docs: …` (this repo has no scopes), a short body, and exactly this trailer, nothing else agent-related (no session links):
  `Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>`
- The pre-commit hook runs fmt, clippy, `node --test`, svelte-check, the build and web-ext lint; a commit that fails it isn't made. Playwright runs only on pre-push, so run it yourself.
- Commands, from the repo root:
  - node tests: `nix develop -c node --test tests/*.test.mjs`
  - one UI test: `nix develop -c npm run --prefix extension test -- -g "<test name>"`
  - all UI tests: `nix develop -c npm run --prefix extension test`
  - types: `nix develop -c npm run --prefix extension check`
- Defaults: padding tied, 2.5rem both ways; bookmarks 4 columns, row height 8.75rem, gap 1.25rem, flow rows, placement floating. The default bookmarks (four) stay.
- The menu's and the bookmarks' corners are the same radius, `rounded-2xl`.

## Review Focus

1. **Old saved bookmark settings** (`columns: "200px 1fr 2fr"`, `rows: "minmax(3.25rem, auto)"`, `gap: "0.75rem 1.5rem"`) must load without an error and fall back to the defaults, not NaN or a broken grid. Pinned in Task 5's node test.
2. **The open tab hidden**: hiding the tab the menu is showing must switch to the first visible tab, not leave an empty panel or throw. Pinned in Task 3.
3. **Settings replaced from another tab** (`app.settings` swapped whole) while a Components row or a Hide checkbox is open: the toggle must write to the live settings. The rows call `at(app.settings)` on every render and every change; pinned in Task 4 by toggling after a reload.
4. **Everything hidden**: menu, toolbar, clock and bookmarks all hidden must leave an empty page with Ctrl+, still opening Settings, no error. Pinned in Task 3.
5. **Edit mode on an empty bookmarks list** must still show the bookmarks part and its pen box (so a bookmark can be added), while outside edit mode it's gone. Pinned in Task 6.

---

### Task 1: Page padding (spec A)

**Files:**
- Modify: `extension/src/store.svelte.ts` (Settings, DEFAULTS, complete)
- Modify: `extension/src/components/CtLayout.svelte`
- Modify: `extension/src/components/CtSettings.svelte` (General tab)
- Test: `extension/tests/newtab.spec.ts`
- Docs: `docs/src/guides/widgets.md` (a short *Page* section before *Toolbar*), `CHANGELOG.md`

**Interfaces:**
- Produces: `settings.padding: { tied: boolean; x: number; y: number }` (rem). `CtLayout`'s `main` has class `ct-page` and reads `--px`, `--pt`, `--pb`. Task 5 and 6 change how `--pb` is computed.

- [ ] **Step 1: Write the failing test** (append to `extension/tests/newtab.spec.ts`)

```ts
test("the page's padding is one setting, or two when untied", async ({ page }) => {
  const main = page.locator(".ct-page");
  await expect(main).toHaveCSS("padding-top", "40px");
  await expect(main).toHaveCSS("padding-left", "40px");
  await page.keyboard.press("Control+,");
  await panel(page).getByRole("slider", { name: "Padding" }).fill("4");
  await expect(main).toHaveCSS("padding-top", "64px");
  await expect(main).toHaveCSS("padding-right", "64px");
  await panel(page).getByRole("checkbox", { name: "Same on every side" }).uncheck();
  await panel(page).getByRole("slider", { name: "Vertical" }).fill("1");
  await expect(main).toHaveCSS("padding-top", "16px");
  await expect(main).toHaveCSS("padding-left", "64px");
});
```

- [ ] **Step 2: Run it, expect FAIL** (padding-top is 16px today, no Padding slider)

Run: `nix develop -c npm run --prefix extension test -- -g "padding is one setting"`

- [ ] **Step 3: Settings.** In `store.svelte.ts` add to `Settings` (after `font`):

```ts
  // The page's padding, rem: `x` left and right, `y` top and bottom, or
  // `x` all round while tied.
  padding: { tied: boolean; x: number; y: number };
```

to `DEFAULTS`: `padding: { tied: true, x: 2.5, y: 2.5 },` and in `complete()` next to `s.background = …`:

```ts
  s.padding = { ...DEFAULTS.padding, ...s.padding };
```

- [ ] **Step 4: Layout.** In `CtLayout.svelte`'s script:

```ts
  const pad = $derived(app.settings.padding);
  const y = $derived(pad.tied ? pad.x : pad.y);
```

and on `main` replace `px-10 pt-4` with `px-(--px) pt-(--pt) pb-(--pb)` and add
`style:--px="{pad.x}rem" style:--pt="{y}rem" style:--pb="{y}rem"`.

- [ ] **Step 5: The form.** In `CtSettings.svelte`'s General tab, after the Font `CtForm`:

```svelte
      <CtForm
        fields={[
          { key: "tied", label: "Same on every side", type: "checkbox" },
          { key: "x", label: "Padding", type: "range", min: 0, max: 6, step: 0.25, unit: "rem", when: (v) => v.tied },
          { key: "x", label: "Horizontal", type: "range", min: 0, max: 6, step: 0.25, unit: "rem", when: (v) => !v.tied },
          { key: "y", label: "Vertical", type: "range", min: 0, max: 6, step: 0.25, unit: "rem", when: (v) => !v.tied },
        ]}
        values={app.settings.padding}
      />
```

A range input binds a string in some browsers: if the test shows `padding-top: 0px` after `fill`, coerce in the layout with `Number(pad.x)`.

- [ ] **Step 6: Run the test, expect PASS**, then the whole UI suite (the bookmarks now sit 2.5rem off the bottom; nothing asserts that yet).

- [ ] **Step 7: Docs.** `widgets.md`: a `## Page` section: the padding, tied by default at 2.5rem, *Horizontal* and *Vertical* when untied, in Settings › General. `CHANGELOG.md` `### Added`: *Padding* for the page's sides, top and bottom.

- [ ] **Step 8: Commit** `feat: the page's padding, tied or per axis`

---

### Task 2: Pen boxes inside the part, and one for the menu (spec B)

**Files:**
- Modify: `extension/src/components/CtEditOverlay.svelte`
- Modify: `extension/src/components/CtMenu.svelte`
- Modify: `extension/src/widgets.ts`
- Test: `extension/tests/newtab.spec.ts`
- Docs: `widgets.md` (edit mode), `CHANGELOG.md`

**Interfaces:**
- Produces: `CtMenu.svelte` exports `widget: WidgetInfo = { label: "Menu", defaults: {}, fields: [] }` from `<script module>`; `widgets.ts` exports `menu` (that info). The overlay's root has class `ct-edit`. Task 3 relies on `menu` and on the menu's settings being `app.settings.menu`.

- [ ] **Step 1: Failing test**

```ts
test("the pen's outline is drawn inside each part, and the menu has its own", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await expect(page.locator(".ct-edit").first()).toHaveCSS("outline-offset", "-2px");
  await expect(page.getByTitle("Edit Menu")).toBeVisible();
  await menuButton(page).click();
  await expect(page.getByTitle("Edit Menu")).toBeVisible();
  await page.getByTitle("Edit Menu").click();
  await expect(title(page)).toHaveText("Menu");
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: The overlay.** In `CtEditOverlay.svelte` change the root's classes from `outline-offset-2` to `-outline-offset-2` and add `ct-edit`. Update its comment: the outline is inside the part, since the menu's panel clips what overflows it and the bookmarks can sit on the window's edge.

- [ ] **Step 4: The menu's info.** Add to the top of `CtMenu.svelte`:

```svelte
<script module lang="ts">
  import type { WidgetInfo } from "../fields.ts";

  // The menu's own settings are where it's open and on which tab; the pen
  // edits the menu as a whole.
  export const widget: WidgetInfo = { label: "Menu", defaults: {}, fields: [] };
</script>
```

In `widgets.ts` add after `parts` (not inside it: `complete()` fills each of `parts` from its defaults, and the menu's settings have their own shape):

```ts
export const menu = info("CtMenu");
```

If the build fails with a TDZ/"cannot access before initialization" error from the CtMenu ↔ widgets.ts import cycle, move the `widget` object into `widgets.ts` as `export const menu: WidgetInfo = …` and drop the module script; say so in the commit body.

- [ ] **Step 5: The menu's pen box.** In `CtMenu.svelte` import `menu as menuInfo` from `../widgets.ts` (the local `menu` is the settings). Collapsed: wrap the menu button in `<span class="relative">…</span>` and render inside it `{#if app.editing && !menu.open}<CtEditOverlay info={menuInfo} at={(s) => s.menu} />{/if}`. The tabs' wrapper `div` clips with `overflow-hidden`, which would cut the chip off: make that class conditional, `{menu.open ? 'overflow-hidden' : ''}` (there are no tabs to clip while it's closed). Open: right after the panel's `{/if}` (as a child of `section`, outside the panel's clipping), `{#if app.editing && menu.open}<CtEditOverlay info={menuInfo} at={(s) => s.menu} />{/if}`.

- [ ] **Step 6: Run the test and the whole UI suite, expect PASS.** The existing "the clock can't be edited while a tab covers it" must still pass.

- [ ] **Step 7: Docs.** `widgets.md`: where edit mode is described, the menu's own pen box (the button closed, the whole panel open). `CHANGELOG.md` `### Changed`: the pen's outline no longer loses sides; the menu has a pen box of its own.

- [ ] **Step 8: Commit** `feat: pen boxes drawn inside their part, and one for the menu`

---

### Task 3: Hiding (spec C)

**Files:**
- Modify: `extension/src/fields.ts` (WidgetInfo)
- Modify: `extension/src/widgets.ts` (placeables)
- Modify: `extension/src/components/CtPartEditor.svelte`
- Modify: `extension/src/components/CtMenu.svelte`, `CtLayout.svelte`
- Modify: `extension/src/components/widgets/CtToolbar.svelte` (hideHint)
- Test: `extension/tests/newtab.spec.ts`
- Docs: `widgets.md`, `plugins.md`, `fields.ts`'s header comment, `widgets.ts`'s header comment, `CHANGELOG.md`

**Interfaces:**
- Consumes: `menu` from Task 2.
- Produces (Task 4 uses these exactly):

```ts
// widgets.ts
export type Placeable = { name: string; label: string; info: WidgetInfo; ours: boolean; at: (s: Settings) => Record<string, any> };
export const placeables: Placeable[];
```

  `WidgetInfo.hideHint?: string`. Every placeable's settings object may carry `hidden: boolean` (absent = shown).

- [ ] **Step 1: Failing tests**

```ts
test("any part hides from its pen, the toolbar with a warning", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.getByTitle("Edit Toolbar").click();
  await expect(panel(page).getByText(/Ctrl\+,/)).toBeVisible();
  await page.getByTitle("Edit Clock and date").click();
  const hide = panel(page).getByRole("checkbox", { name: "Hide" });
  await hide.check();
  await expect(page.locator(".ct-clock")).toHaveCount(0);
  await hide.uncheck();
  await expect(page.locator(".ct-clock")).toBeVisible();
});

test("a hidden tab leaves the bar, and the menu opens on the next one", async ({ page }) => {
  await menuButton(page).click();
  await tabButton(page, "Hello").click();
  await page.getByTitle("Edit", { exact: true }).click();
  await page.getByTitle("Edit Hello").click();
  await panel(page).getByRole("checkbox", { name: "Hide" }).check();
  await expect(tabButton(page, "Hello")).toHaveCount(0);
  await expect(page.locator(".hello")).toHaveCount(0);
  await expect(page.locator(".ct-tab")).toHaveCount(1);
});

test("with everything hidden, the page is empty and Ctrl+, still opens Settings", async ({ page }) => {
  await page.evaluate(async () => {
    const store = (window as any).browser.storage.local;
    const { settings } = await store.get("settings");
    for (const k of ["clock", "toolbar", "bookmarks", "menu"]) settings[k] = { ...settings[k], hidden: true };
    await store.set({ settings });
  });
  await page.reload();
  await expect(page.locator(".ct-menu nav")).toHaveCount(0);
  await expect(page.locator(".ct-clock, .ct-bookmarks, .ct-toolbar")).toHaveCount(0);
  await page.keyboard.press("Control+,");
  await expect(panel(page)).toBeVisible();
});
```

The `beforeEach` waits for `.ct-clock` before the reload, so the third test works as written. Check `.ct-toolbar` is the toolbar's root class (`grep -n 'class="ct-' extension/src/components/widgets/CtToolbar.svelte`); use whatever it is.

- [ ] **Step 2: Run them, expect FAIL.**

- [ ] **Step 3: fields.ts.** In `WidgetInfo` add:

```ts
  // Under the Hide checkbox every part and tab gets, when hiding it needs a
  // word of warning.
  hideHint?: string;
```

Extend the header comment: every part and tab gets a Hide checkbox, last in its form, so a component implements nothing to be hideable; a component that exports neither `widget` nor `tab` is a building block for others, with no pen, no Hide and no row in Settings › Components.

- [ ] **Step 4: The editor.** `CtPartEditor.svelte` becomes:

```svelte
<!-- One part's settings (the clock, the toolbar, a menu tab …), in the side
     panel, from edit mode or Settings › Components. Changes apply as they're
     made. Hide is every part's, last. -->
<script lang="ts">
  import type { WidgetInfo } from "../fields.ts";
  import CtForm from "./CtForm.svelte";

  let { info, values }: { info: WidgetInfo; values: Record<string, any>; onclose?: () => void } = $props();
  const fields = $derived([...info.fields, { key: "hidden", label: "Hide", type: "checkbox" as const, hint: info.hideHint }]);
</script>

<CtForm {fields} {values} />
```

- [ ] **Step 5: The toolbar's hint.** In `CtToolbar.svelte`'s `widget` add `hideHint: "Settings open with Ctrl+, without it, and Components there shows it again."`

- [ ] **Step 6: placeables.** In `widgets.ts` (type-only import of `Settings` from `./store.svelte.ts` is fine; the store imports this module for values, not types):

```ts
// Every component the page places, and so hides: a part, the menu or a menu
// tab. `at` finds its settings in app.settings afresh each time (see App.focus).
export type Placeable = { name: string; label: string; info: WidgetInfo; ours: boolean; at: (s: Settings) => Record<string, any> };
export const placeables: Placeable[] = [
  { name: "CtMenu", label: menu.label, info: menu, ours: true, at: (s) => s.menu },
  { name: "CtClock", label: parts.clock.label, info: parts.clock, ours: true, at: (s) => s.clock },
  { name: "CtToolbar", label: parts.toolbar.label, info: parts.toolbar, ours: true, at: (s) => s.toolbar },
  { name: "CtBookmarks", label: parts.bookmarks.label, info: parts.bookmarks, ours: true, at: (s) => s.bookmarks },
  ...tabs.map((t) => ({ name: t.name, label: t.tab.label, info: t.tab as WidgetInfo, ours: t.name.startsWith("Ct"), at: (s: Settings) => s.menu.tabs[t.name] })),
];
```

Update the header comment to say the same in one line.

- [ ] **Step 7: The menu hides, and its hidden tabs.** In `CtMenu.svelte`:

```ts
  // Tabs hidden from their pen or from Settings › Components are off the bar.
  const shown = $derived(tabs.filter((t) => !menu.tabs[t.name]?.hidden));
  const current = $derived(shown.find((t) => t.name === menu.tab) ?? shown[0]);
  const open = $derived(menu.open && !menu.hidden);
  const toolbar = $derived(app.settings.toolbar);
```

Use `shown` instead of `tabs` in the bar's `{#each}` and in `pick()`'s `findIndex` calls; use `open` instead of `menu.open` wherever the panel, the tabs and the clock decide whether to show (`{#if menu.open}` around the panel → `{#if open}`, the tabs' `{#if menu.open}` → `{#if open}`, `{#if !menu.open}` around the clock → `{#if !open && !app.settings.clock.hidden}`, and the menu pen boxes from Task 2). Keep `toggle()` flipping `menu.open`. Wrap the menu button's `<span class="relative">` in `{#if !menu.hidden}`. Wrap the toolbar's `div` in `{#if !toolbar.hidden}`. Wrap the whole `nav` in `{#if !menu.hidden || !toolbar.hidden}`; the panel's spacer uses `bar`, which stays 0 with no nav, which is right.

- [ ] **Step 8: The bookmarks hide.** In `CtLayout.svelte` wrap the bookmarks `section` in `{#if !app.settings.bookmarks.hidden}` (Task 6 refines this).

- [ ] **Step 9: Run the three tests and the whole UI suite, expect PASS**; `nix develop -c npm run --prefix extension check` clean.

- [ ] **Step 10: Docs.** `widgets.md`: Hide is the last option of every part's and tab's pen; hiding the menu takes the button and the panel, not the clock; a hidden open tab gives way to the first visible one; the toolbar's warning. `plugins.md` (*Your own components*): a tab of yours gets Hide for free; a component that exports neither `widget` nor `tab` is a building block, with no pen or Hide of its own. `CHANGELOG.md` `### Added`: *Hide* on every part and tab.

- [ ] **Step 11: Commit** `feat: hide any part or tab from its pen`

---

### Task 4: Settings › Components, and the plugin ideas (spec D)

**Files:**
- Modify: `extension/src/components/CtSettings.svelte`
- Modify: `IDEAS.md`
- Test: `extension/tests/newtab.spec.ts`
- Docs: `widgets.md`, `plugins.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `placeables`, `Placeable` (Task 3), `edit` (store), `CtPartEditor`.

- [ ] **Step 1: Failing test**

```ts
test("Settings › Components lists ours and yours, toggles them and opens their settings", async ({ page }) => {
  await page.keyboard.press("Control+,");
  await panel(page).getByRole("tab", { name: "Components" }).click();
  const yours = panel(page).getByRole("group", { name: "Yours" });
  await expect(yours.getByRole("switch")).toHaveCount(1);
  await expect(yours.getByRole("button", { name: "Hello" })).toBeVisible();
  const clock = panel(page).getByRole("switch", { name: "Show Clock and date" });
  await clock.uncheck();
  await expect(page.locator(".ct-clock")).toHaveCount(0);
  // The toggle writes to the live settings, even after they're replaced.
  await page.reload();
  await page.keyboard.press("Control+,");
  await panel(page).getByRole("tab", { name: "Components" }).click();
  await panel(page).getByRole("switch", { name: "Show Clock and date" }).check();
  await expect(page.locator(".ct-clock")).toBeVisible();
  await panel(page).getByRole("button", { name: "Toolbar" }).click();
  await expect(title(page)).toHaveText("Toolbar");
});
```

The `beforeEach` waits for `.ct-clock`; the clock is back on by the time the test ends, and the reload happens with it hidden, which is fine since `beforeEach` already ran.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: The tab.** In `CtSettings.svelte` import `placeables` from `../widgets.ts`, `edit` from the store (already imports `complete, DEFAULTS`) and `CtPartEditor`. Tabs become `["General", "Components", "Background", "Websites", "Browser", "Advanced"]`; shift every later `tab === n` by one (Background 2, Websites 3, Browser 4, Advanced the `{:else}`). Change General's hint to: *The clock, the toolbar, the bookmarks, the menu and each of its tabs are edited from the page (turn on the pen and pick one) or from Components.* Add the Components tab after General:

```svelte
  {:else if tab === 1}
    <!-- A row's toggle shows or hides it; the rest of the row opens its
         settings, the pen's form. Hidden rows are greyed. -->
    <div class="grid gap-6">
      {#each [["Ours", placeables.filter((c) => c.ours)], ["Yours", placeables.filter((c) => !c.ours)]] as [heading, list] (heading)}
        <div class="grid gap-1" role="group" aria-labelledby="ct-components-{heading}">
          <h3 id="ct-components-{heading}" class="m-0 mb-1 text-lg font-medium">{heading}</h3>
          {#each list as c (c.name)}
            <div class="flex items-center gap-2 rounded-xl px-3 py-1.5 hover:bg-surface-container-high">
              <button
                type="button"
                class="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent py-1 text-left text-base {c.at(app.settings).hidden ? 'text-on-surface-variant/60' : 'text-on-surface'}"
                onclick={() => edit(app, c.label, CtPartEditor, () => ({ info: c.info, values: c.at(app.settings) }))}>{c.label}</button
              >
              <input
                type="checkbox"
                role="switch"
                class="m-0 size-4.5 cursor-pointer accent-primary"
                aria-label="Show {c.label}"
                checked={!c.at(app.settings).hidden}
                onchange={(e) => (c.at(app.settings).hidden = !e.currentTarget.checked)}
              />
            </div>
          {:else}
            <p class="m-0 {hint}">
              None yet. Yours go in <code>~/.config/caelestia-tab/components/</code>, then <code>npm run --prefix extension build</code>: see the handbook's Plugins guide.
            </p>
          {/each}
        </div>
      {/each}
    </div>
```

`list` comes out of the tuple as a union; if svelte-check complains, type the groups: `const groups: [string, Placeable[]][] = [...]` in the script.

- [ ] **Step 4: Run the test, then the whole UI suite (tabs by name, so the index shift shouldn't break any), expect PASS.**

- [ ] **Step 5: IDEAS.md.** Add a section (keep the file's voice; put it near the plugin philosophy):

```md
## Plugins from git, and an editor in the browser (noted 2026-09-30)

- A library of our components and types, so a user's components get
  autocomplete, and live in their own git repos.
- A Plugins section in Settings that imports those repos, with a rebuild
  button that builds the extension with them.
- Settings › Components' *+* then creates one.
- An editor in the page for components, the custom CSS and each website's
  CSS, with autocomplete on the scheme's variables and our components.
  Until then, user components are files and a build (Plugins guide).
```

- [ ] **Step 6: Docs.** `widgets.md`: Settings › Components, second tab: ours and yours, the toggle, greyed when hidden, the row opening the settings. `plugins.md`: yours are listed there once built in. `CHANGELOG.md` `### Added`: *Components* in Settings.

- [ ] **Step 7: Commit** `feat: a Components section in Settings to show, hide and edit each part`

---

### Task 5: Bookmarks: numbers, a flow switch, floating or docked (spec E)

**Files:**
- Create: `extension/src/bookmarks.ts`
- Modify: `extension/src/fields.ts` (switch type), `extension/src/components/CtField.svelte`
- Modify: `extension/src/components/widgets/CtBookmarks.svelte`
- Modify: `extension/src/store.svelte.ts` (complete)
- Modify: `extension/src/components/CtLayout.svelte` (`--pb`)
- Modify: `extension/src/layout.ts` (delete `evenColumns`), `tests/extension.test.mjs`
- Test: `tests/extension.test.mjs`, `extension/tests/newtab.spec.ts`
- Docs: `widgets.md` (*Bookmarks*), `CHANGELOG.md`

**Interfaces:**
- Produces: bookmarks settings `{ flow: "row" | "column"; count: number; rowHeight: number; gap: number; placement: "floating" | "docked"; items; hidden? }`. `bookmarkOptions(saved: Record<string, any>): Record<string, any>` in `bookmarks.ts`. Field type `{ key; label; hint?; type: "switch"; options: [[string, string], [string, string]] }`. Task 6 reads `placement`.

- [ ] **Step 1: Failing node test.** In `tests/extension.test.mjs` replace the *even rows* test with:

```js
test("bookmarks saved as CSS strings load as numbers, and junk as the defaults", async () => {
  const { bookmarkOptions } = await import("../extension/src/bookmarks.ts");
  assert.deepEqual(bookmarkOptions({ even: true, tileWidth: "11rem", columns: "repeat(5, minmax(0, 1fr))", rows: "8.75rem", gap: "1.25rem", flow: "row dense", items: [] }), {
    count: 5,
    rowHeight: 8.75,
    gap: 1.25,
    flow: "row",
    items: [],
  });
  assert.deepEqual(bookmarkOptions({ columns: "200px 1fr 2fr", rows: "minmax(3.25rem, auto)", gap: "0.75rem 1.5rem", flow: "column dense" }), { flow: "column" }, "unparseable: left for the defaults");
  const now = { flow: "column", count: 3, rowHeight: 4, gap: 0.5, placement: "docked", hidden: true };
  assert.deepEqual(bookmarkOptions(now), now, "today's shape passes through");
});
```

Update the file's first comment (`layout.ts` → `bookmarks.ts`).

- [ ] **Step 2: Run, expect FAIL** (no module). `nix develop -c node --test tests/*.test.mjs`

- [ ] **Step 3: bookmarks.ts**

```ts
// The bookmarks' grid settings were CSS strings (grid-template-columns and
// the like, and "even rows"); they're numbers now. This takes an older
// shape to the new one, keeping only what it can read: complete() fills the
// rest from the defaults.

const rem = (v: unknown) => {
  const m = /^\s*(\d*\.?\d+)\s*rem\s*$/.exec(String(v));
  return m ? Number(m[1]) : undefined;
};

export function bookmarkOptions(saved: Record<string, any>): Record<string, any> {
  const { even, tileWidth, columns, rows, ...s } = saved;
  const repeat = /^\s*repeat\(\s*(\d+)\s*,/.exec(String(columns ?? ""));
  if (s.count === undefined && repeat) s.count = Number(repeat[1]);
  if (s.rowHeight === undefined && rows !== undefined) s.rowHeight = rem(rows);
  if (typeof s.gap === "string") s.gap = rem(s.gap);
  if (typeof s.flow === "string") s.flow = s.flow.startsWith("column") ? "column" : "row";
  for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
  return s;
}
```

(`even` and `tileWidth` are destructured to drop them; if lint flags them unused, prefix with `_` or use `delete` on a copy.)

- [ ] **Step 4: Run the node test, expect PASS.**

- [ ] **Step 5: complete().** In `store.svelte.ts` import `bookmarkOptions` from `./bookmarks.ts`, and *before* the `for (const [key, info] of Object.entries(parts))` loop (so the old strings are read before the defaults fill in):

```ts
  s.bookmarks = bookmarkOptions(s.bookmarks ?? {});
```

- [ ] **Step 6: The switch field.** `fields.ts`, in `Field`'s union:

```ts
  // One of two values, side by side.
  | { key: string; label: string; hint?: string; type: "switch"; options: [[string, string], [string, string]] }
```

`CtField.svelte`, before `{:else if field.type === "checkbox"}`:

```svelte
{:else if field.type === "switch"}
  <div class="grid gap-1.5">
    <span id="{uid}-label">{field.label}</span>
    <div class="inline-flex w-fit gap-1 rounded-3xl bg-surface-container-highest p-1" role="radiogroup" aria-labelledby="{uid}-label" aria-describedby={described}>
      {#each field.options as [value, label] (value)}
        <button
          type="button"
          role="radio"
          aria-checked={values[field.key] === value}
          class="cursor-pointer rounded-full border-0 px-4 py-2 {values[field.key] === value ? 'bg-primary text-on-primary' : 'bg-transparent text-on-surface'}"
          onclick={() => (values[field.key] = value)}>{label}</button
        >
      {/each}
    </div>
    {@render note(field.hint)}
  </div>
```

- [ ] **Step 7: CtBookmarks' settings.** Replace `PRESETS`, `defaults` (keep `items`) and `fields`:

```ts
  const PRESETS = [
    { label: "Tiles", values: { count: 4, rowHeight: 8.75, gap: 1.25 } },
    { label: "List", values: { count: 3, rowHeight: 3.25, gap: 0.75 } },
  ];
  …
    defaults: { ...PRESETS[0].values, flow: "row", placement: "floating", items: [ /* the four, unchanged */ ] },
    fields: [
      { type: "presets", label: "Start from", presets: PRESETS },
      { key: "flow", label: "Flow", type: "switch", options: [["row", "Rows"], ["column", "Columns"]], hint: "Which way the tiles fill, gaps filled as they go." },
      { key: "count", label: "Columns", type: "number", min: 1, max: 12, when: (v) => v.flow !== "column" },
      { key: "count", label: "Rows", type: "number", min: 1, max: 12, when: (v) => v.flow === "column" },
      { key: "rowHeight", label: "Row height", type: "range", min: 2, max: 16, step: 0.25, unit: "rem" },
      { key: "gap", label: "Gap", type: "range", min: 0, max: 4, step: 0.25, unit: "rem" },
      { key: "placement", label: "Placement", type: "switch", options: [["floating", "Floating"], ["docked", "Docked"]], hint: "Floating, rounded like the menu with the page's padding under it; docked, flush with the window's bottom." },
    ],
```

Order check against the spec: presets, flow, count, row height, gap, placement, then Hide (added by `CtPartEditor`).

- [ ] **Step 8: CtBookmarks' grid.** Delete `probe`, `even`, the `$effect` that computes it, the `evenColumns` import and the probe `<span>`. The root and the grid become:

```svelte
<div
  class="ct-bookmarks box-border rounded-t-2xl border-0 border-t-4 border-solid border-primary bg-glass p-7 backdrop-blur-[8px] {settings.placement === 'docked' ? 'rounded-b-none' : 'rounded-b-2xl'}"
>
  <!-- Rows: a fixed number of columns, rows added as needed; columns: the
       other way round, the columns sharing the width. Dense either way. -->
  <div
    bind:this={grid}
    class="relative grid gap-(--gap) {settings.flow === 'column' ? 'grid-flow-col-dense grid-rows-(--tracks) auto-cols-[minmax(0,1fr)]' : 'grid-flow-row-dense grid-cols-(--tracks) auto-rows-(--row)'}"
    style:--tracks={settings.flow === "column" ? `repeat(${settings.count}, ${settings.rowHeight}rem)` : `repeat(${settings.count}, minmax(0, 1fr))`}
    style:--row="{settings.rowHeight}rem"
    style:--gap="{settings.gap}rem"
  >
```

Drop `bind:this={grid}` and `let grid` too if nothing else uses them. The top border follows the rounded top corners by itself (a border-radius curves the border with it); both placements share the menu's `rounded-2xl`.

- [ ] **Step 9: Docked bookmarks sit on the bottom edge.** In `CtLayout.svelte`: `style:--pb={app.settings.bookmarks.placement === "docked" && !app.settings.bookmarks.hidden ? "0rem" : `${y}rem`}`.

- [ ] **Step 10: layout.ts.** Delete `evenColumns` and its comment (keep `edges`).

- [ ] **Step 11: UI test** (append):

```ts
test("the bookmarks' count follows the flow's name, and they float or dock", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.getByTitle("Edit Bookmarks").click();
  await expect(panel(page).getByRole("spinbutton", { name: "Columns" })).toHaveValue("4");
  await panel(page).getByRole("radio", { name: "Columns" }).click();
  await expect(panel(page).getByRole("spinbutton", { name: "Rows" })).toBeVisible();
  await expect(panel(page).getByRole("spinbutton", { name: "Columns" })).toHaveCount(0);
  const bottom = () => page.locator(".ct-bookmarks").evaluate((el) => innerHeight - el.getBoundingClientRect().bottom);
  expect(await bottom()).toBeCloseTo(40, 0);
  await panel(page).getByRole("radio", { name: "Docked" }).click();
  await expect.poll(bottom).toBeCloseTo(0, 0);
});
```

- [ ] **Step 12: Run the node tests, this test and the whole UI suite, expect PASS.** Grep for leftovers: `grep -rn "evenColumns\|tileWidth\|\.even\b\|settings.columns\|settings.rows" extension/src tests` → nothing.

- [ ] **Step 13: Docs.** `widgets.md` *Bookmarks*: the fields as they are now (flow switch, the count named for it, row height and gap in rem, floating or docked, both rounded like the menu); drop anything about even rows, narrowest tile and `grid-template-*` strings. `CHANGELOG.md`: `### Changed` the grid settings are numbers, older ones carried over; *Placement* (floating by default) under `### Added`; `### Removed` *Even rows* and *Narrowest tile*.

- [ ] **Step 14: Commit** `feat: the bookmarks' grid in numbers, a flow switch, floating or docked`

---

### Task 6: No bookmarks, the menu fills the page (spec F)

**Files:**
- Modify: `extension/src/components/CtLayout.svelte`
- Test: `extension/tests/newtab.spec.ts`
- Docs: `widgets.md`, `CHANGELOG.md`

- [ ] **Step 1: Failing test**

```ts
test("with no bookmarks the menu fills the page, but edit mode keeps their pen box", async ({ page }) => {
  await page.evaluate(async () => {
    const store = (window as any).browser.storage.local;
    const { settings } = await store.get("settings");
    settings.bookmarks = { ...settings.bookmarks, items: [] };
    await store.set({ settings });
  });
  await page.reload();
  await expect(page.locator(".ct-bookmarks")).toHaveCount(0);
  const menuBottom = () => page.locator(".ct-menu").evaluate((el) => innerHeight - el.getBoundingClientRect().bottom);
  await expect.poll(menuBottom).toBeCloseTo(40, 0);
  await page.getByTitle("Edit", { exact: true }).click();
  await expect(page.getByTitle("Edit Bookmarks")).toBeVisible();
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** In `CtLayout.svelte`:

```ts
  const marks = $derived(app.settings.bookmarks);
  // No bookmarks to show, and the menu takes the page; edit mode keeps an
  // empty list on it, so its pen box can add one.
  const shown = $derived(!marks.hidden && (marks.items.length > 0 || app.editing));
```

`main`'s `grid-rows-[minmax(0,1fr)_auto]` → `{shown ? 'grid-rows-[minmax(0,1fr)_auto]' : 'grid-rows-[minmax(0,1fr)]'}`; the section's `{#if}` from Task 3 → `{#if shown}`; `--pb` from Task 5 → `shown && marks.placement === "docked" ? "0rem" : `${y}rem``.

- [ ] **Step 4: Run the test and the whole UI suite, expect PASS.**

- [ ] **Step 5: Docs.** `widgets.md`: hidden or empty bookmarks give the menu the page (in edit mode an empty list stays, for its pen). `CHANGELOG.md` `### Changed`.

- [ ] **Step 6: Commit** `feat: the menu fills the page when there are no bookmarks`

---

### Task 7: Whole-branch check

- [ ] `nix develop -c pre-commit run --all-files` if configured, else the hook's steps: `nix develop -c node --test tests/*.test.mjs`, `nix develop -c npm run --prefix extension check`, `nix develop -c npm run --prefix extension test`, and `nix develop -c mdbook build docs` (the book builds).
- [ ] `git log main..HEAD | grep -i "claude-session\|claude.ai/code"` → nothing.
- [ ] Re-read `widgets.md`, `plugins.md` and the CHANGELOG's `[Unreleased]` against the code once more; follow any links added.
