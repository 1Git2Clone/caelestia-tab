<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";
  import CtBookmarkEditor from "../CtBookmarkEditor.svelte";
  import { edit, type App as State } from "../../store.svelte.ts";

  // Opens a bookmark in the side panel; a new one is added first, so the
  // page shows it while it's being filled in.
  function editItem(app: State, settings: any, index: number) {
    if (index < 0) {
      settings.items.push(item({ name: "New bookmark", url: "" }));
      index = settings.items.length - 1;
    }
    const it = settings.items[index];
    edit(app, () => it.name || "Bookmark", CtBookmarkEditor, { settings, index });
  }

  const PRESETS = [
    { label: "Tiles", values: { even: true, tileWidth: "11rem", columns: "repeat(5, minmax(0, 1fr))", rows: "8.75rem", gap: "1.25rem" } },
    { label: "List", values: { even: false, columns: "repeat(3, minmax(0, 1fr))", rows: "3.25rem", gap: "0.75rem" } },
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
    width: 1,
    height: 1,
    column: "",
    row: "",
    ...props,
  });

  export const widget: WidgetInfo = {
    label: "Bookmarks",
    place: { justify: "stretch", align: "end" },
    defaults: {
      ...PRESETS[0].values,
      flow: "row dense",
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
      { key: "even", label: "Even rows", type: "checkbox", hint: "Spreads the tiles evenly over as few rows as fit: 5, or 3 and 2, never 4 and 1. Columns is ignored while it's on." },
      { key: "tileWidth", label: "Narrowest tile", type: "text", hint: "For even rows: 11rem, 160px …" },
      { key: "columns", label: "Columns", type: "text", hint: "grid-template-columns: repeat(5, minmax(0, 1fr)), 200px 1fr 2fr, repeat(auto-fill, minmax(10rem, 1fr)) …" },
      { key: "rows", label: "Row height", type: "text", hint: "grid-auto-rows: 8.75rem, minmax(3.25rem, auto) …" },
      { key: "gap", label: "Gap", type: "text", hint: "gap: 1.25rem, or 0.75rem 1.5rem for rows and columns." },
      {
        key: "flow",
        label: "Flow",
        type: "select",
        options: [
          ["row", "Rows"],
          ["row dense", "Rows, filling gaps"],
          ["column", "Columns"],
          ["column dense", "Columns, filling gaps"],
        ],
      },
    ],
    actions: [{ icon: "add", title: "Add a bookmark", run: (settings, app) => editItem(app, settings, -1) }],
  };
</script>

<script lang="ts">
  import { getContext } from "svelte";
  import { evenColumns } from "../../layout.ts";
  import type { App } from "../../store.svelte.ts";
  import CtIcon from "../CtIcon.svelte";
  import CtTile from "../CtTile.svelte";

  let { settings, editing = false }: { settings: any; editing?: boolean } = $props();
  const app = getContext<App>("ct");

  let grid: HTMLElement | undefined = $state();
  let probe: HTMLElement | undefined = $state();
  let even: number | null = $state(null);
  $effect(() => {
    if (!settings.even || !grid || !probe) return void (even = null);
    const spans = settings.items.map((it: any) => it.width);
    // A frame later: changing the columns inside the observer's callback
    // resizes what it observes, which the browser reports as a loop.
    const layout = () =>
      requestAnimationFrame(() => {
        const gap = parseFloat(getComputedStyle(grid!).columnGap) || 0;
        // The probe resolves the width setting, whatever its unit.
        even = evenColumns(grid!.clientWidth, probe!.offsetWidth || 176, gap, spans);
      });
    const observer = new ResizeObserver(layout);
    observer.observe(grid);
    return () => observer.disconnect();
  });

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
  class="ct-bookmarks box-border rounded-b-2xl border-0 border-t-4 border-solid border-primary bg-glass p-7 backdrop-blur-[8px] in-[.ct-edge-bottom]:rounded-b-none"
>
  <div
    bind:this={grid}
    class="relative grid auto-rows-(--rows) grid-cols-(--cols) gap-(--gap) {{ row: 'grid-flow-row', 'row dense': 'grid-flow-row-dense', column: 'grid-flow-col', 'column dense': 'grid-flow-col-dense' }[settings.flow as 'row'] ?? ''}"
    style:--cols={even ? `repeat(${even}, minmax(0, 1fr))` : settings.columns}
    style:--rows={settings.rows}
    style:--gap={settings.gap}
  >
    <span bind:this={probe} class="invisible absolute w-(--w)" style:--w={settings.tileWidth} aria-hidden="true"></span>
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
