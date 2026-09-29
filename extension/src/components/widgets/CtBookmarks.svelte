<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";
  import CtBookmarkEditor from "../CtBookmarkEditor.svelte";
  import { edit, type App as State } from "../../store.svelte.ts";

  // Opens a bookmark in the side panel; a new one is added first, so the
  // page shows it while it's being filled in. The editor finds it by its id
  // in app.settings each time (see App.focus).
  function editItem(app: State, settings: any, index: number) {
    if (index < 0) {
      settings.items.push(item({ name: "New bookmark", url: "" }));
      index = settings.items.length - 1;
    }
    const id = settings.items[index].id;
    const find = () => app.settings.bookmarks.items.findIndex((it: any) => it.id === id);
    edit(app, () => app.settings.bookmarks.items[find()]?.name || "Bookmark", CtBookmarkEditor, () => ({ settings: app.settings.bookmarks, index: find() }));
  }

  const PRESETS = [
    { label: "Tiles", values: { count: 4, rowHeight: 8.75, gap: 1.25 } },
    { label: "List", values: { count: 3, rowHeight: 3.25, gap: 0.75 } },
  ];

  export const item = (props: Record<string, any>) => ({
    id: crypto.randomUUID(),
    name: "",
    url: "",
    letter: "",
    glyph: "",
    showLetter: true,
    showName: true,
    image: "",
    colour: "primary",
    // The line under it: "auto" (the colour's complement), "none" or "colour".
    line: "auto",
    lineColour: "primary",
    width: 1,
    height: 1,
    column: "",
    row: "",
    ...props,
  });

  export const widget: WidgetInfo = {
    label: "Bookmarks",
    defaults: {
      ...PRESETS[0].values,
      flow: "row",
      placement: "floating",
      topLine: true,
      topLineColour: "primary",
      items: [
        // nf-fa-github, nf-fa-youtube, nf-fa-wikipedia_w, nf-dev-mozilla
        item({ name: "GitHub", url: "https://github.com", colour: "primary", glyph: "" }),
        item({ name: "YouTube", url: "https://www.youtube.com", colour: "tertiary", width: 2, glyph: "" }),
        item({ name: "Wikipedia", url: "https://www.wikipedia.org", colour: "secondary", glyph: "" }),
        item({ name: "MDN", url: "https://developer.mozilla.org", colour: "primaryContainer", glyph: "" }),
      ],
    },
    fields: [
      { type: "presets", label: "Start from", presets: PRESETS },
      { key: "flow", label: "Flow", type: "switch", options: [["row", "Rows"], ["column", "Columns"]], hint: "Which way the tiles fill, gaps filled as they go." },
      { key: "count", label: "Columns", type: "number", min: 1, max: 12, when: (v) => v.flow !== "column" },
      { key: "count", label: "Rows", type: "number", min: 1, max: 12, when: (v) => v.flow === "column" },
      { key: "rowHeight", label: "Row height", type: "range", min: 2, max: 16, step: 0.25, unit: "rem" },
      { key: "gap", label: "Gap", type: "range", min: 0, max: 4, step: 0.25, unit: "rem" },
      { key: "placement", label: "Placement", type: "switch", options: [["floating", "Floating"], ["docked", "Docked"]], hint: "Floating, rounded like the menu with the page's padding under it; docked, flush with the window's bottom." },
      { key: "topLine", label: "Top line", type: "checkbox" },
      { key: "topLineColour", label: "Line colour", type: "colour", when: (v) => v.topLine },
    ],
    actions: [{ icon: "add", title: "Add a bookmark", run: (settings, app) => editItem(app, settings, -1) }],
  };
</script>

<script lang="ts">
  import { getContext } from "svelte";
  import { cssColour } from "../../scheme.ts";
  import type { App } from "../../store.svelte.ts";
  import CtIcon from "../CtIcon.svelte";
  import CtTile from "../CtTile.svelte";

  let { settings, editing = false }: { settings: any; editing?: boolean } = $props();
  const app = getContext<App>("ct");

  const place = (it: any) => ({ "--col": it.column || `span ${it.width}`, "--row": it.row || `span ${it.height}` });
  function move(from: number, to: number) {
    if (to < 0 || to >= settings.items.length || to === from) return;
    const [it] = settings.items.splice(from, 1);
    settings.items.splice(to, 0, it);
  }

  function remove(index: number) {
    if (confirm(`Remove ${settings.items[index].name || "this bookmark"}?`)) settings.items.splice(index, 1);
  }

  let dragging = $state(-1);
  let over = $state(-1);
  const control = "grid cursor-pointer place-items-center rounded-lg border-0 bg-transparent px-1.5 py-1 text-current hover:bg-[color-mix(in_srgb,var(--caelestia-on-primary)_15%,transparent)]";
</script>

<div
  class="ct-bookmarks box-border rounded-t-2xl border-0 bg-glass p-7 backdrop-blur-[8px] {settings.placement === 'docked' ? 'rounded-b-none' : 'rounded-b-2xl'} {settings.topLine ? 'border-t-4 border-solid border-(--line)' : ''}"
  style:--line={settings.topLine ? cssColour(settings.topLineColour) : undefined}
>
  <!-- Rows: a fixed number of columns, rows added as needed; columns: the
       other way round, the columns sharing the width. Dense either way. -->
  <div
    class="relative grid gap-(--gap) {settings.flow === 'column' ? 'grid-flow-col-dense grid-rows-(--tracks) auto-cols-[minmax(0,1fr)]' : 'grid-flow-row-dense grid-cols-(--tracks) auto-rows-(--row)'}"
    style:--tracks={settings.flow === "column" ? `repeat(${settings.count}, ${settings.rowHeight}rem)` : `repeat(${settings.count}, minmax(0, 1fr))`}
    style:--row="{settings.rowHeight}rem"
    style:--gap="{settings.gap}rem"
  >
    {#each settings.items as it, i (it.id)}
      {#if editing}
        <div
          role="listitem"
          class="ct-slot col-(--col) row-(--row) flex min-h-0 min-w-0 cursor-grab flex-col {dragging === i ? 'opacity-40' : ''} {over === i ? 'outline-3 outline-offset-3 outline-primary outline-dashed rounded-xl' : ''}"
          style:--col={place(it)["--col"]}
          style:--row={place(it)["--row"]}
          draggable="true"
          ondragstart={(e) => {
            e.dataTransfer!.setData("text/x-caelestia-bookmark", String(i));
            e.dataTransfer!.effectAllowed = "move";
            dragging = i;
          }}
          ondragend={() => (dragging = over = -1)}
          ondragover={(e) => {
            if (!e.dataTransfer!.types.includes("text/x-caelestia-bookmark")) return;
            e.preventDefault();
            over = i;
          }}
          ondragleave={() => over === i && (over = -1)}
          ondrop={(e) => {
            e.preventDefault();
            move(Number(e.dataTransfer!.getData("text/x-caelestia-bookmark")), i);
            dragging = over = -1;
          }}
        >
          <!-- The bar is part of the slot's flow, not laid over the tile, so the
               tile's name and mark sit above it however many rows it wraps to. -->
          <CtTile {it} link={false} slot />
          <div class="ct-controls flex flex-wrap items-center justify-around rounded-b-xl bg-primary p-1 text-on-primary">
            <button type="button" class={control} title="Move earlier" onclick={() => move(i, i - 1)}><CtIcon name="left" /></button>
            <span class="{control} cursor-grab" title="Drag to move"><CtIcon name="drag" /></span>
            <button type="button" class={control} title="Move later" onclick={() => move(i, i + 1)}><CtIcon name="right" /></button>
            <button type="button" class={control} title="Edit" onclick={() => editItem(app, settings, i)}><CtIcon name="edit" /></button>
            <button type="button" class={control} title="Remove" onclick={() => remove(i)}><CtIcon name="close" /></button>
          </div>
        </div>
      {:else}
        <div class="col-(--col) row-(--row) grid min-w-0" style:--col={place(it)["--col"]} style:--row={place(it)["--row"]}>
          <CtTile {it} />
        </div>
      {/if}
    {:else}
      <p class="col-span-full m-0 text-center text-on-surface-variant">No bookmarks yet. Add one with the + button.</p>
    {/each}
  </div>
</div>
