<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";
  import CtBookmarkEditor from "../CtBookmarkEditor.svelte";
  import CtBookmarkList from "../CtBookmarkList.svelte";
  import { edit, type App as State } from "../../store.svelte.ts";

  // Opens a bookmark in the side panel; a new one is added first, so the
  // page shows it while it's being filled in. The editor finds it by its id
  // in app.settings each time (see App.focus). `back` is unset from the
  // tile's own pen (back to the main settings) and the list's own focus from
  // CtBookmarkList (back to the list).
  export function editItem(app: State, settings: any, index: number, back?: State["focus"]) {
    if (index < 0) {
      settings.items.push(item({ name: "New bookmark", url: "" }));
      index = settings.items.length - 1;
    }
    const id = settings.items[index].id;
    const find = () => app.settings.bookmarks.items.findIndex((it: any) => it.id === id);
    edit(app, () => app.settings.bookmarks.items[find()]?.name || "Bookmark", CtBookmarkEditor, () => ({ settings: app.settings.bookmarks, index: find() }), back);
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
    // Off the page entirely, unless the bookmarks' own dimHidden is on and
    // the page is in edit mode.
    hidden: false,
    ...props,
  });

  export const widget: WidgetInfo = {
    label: "Bookmarks",
    defaults: {
      count: 5,
      rowHeight: 3.25,
      gap: 2,
      flow: "row",
      placement: "floating",
      topLine: true,
      topLineColour: "primary",
      dimHidden: false,
      items: [
        // nf-oct-mail, nf-linux-forgejo, nf-fa-github, nf-fa-music, nf-fa-youtube,
        // nf-fa-steam, nf-fa-play, nf-fa-images, nf-dev-grafana, nf-md-script_text
        item({ id: "06e760b0-3a8f-47e8-a7f1-73418a3d7c97", name: "Roundcube", url: "https://developer.mozilla.org", colour: "primary", glyph: "\uf42f" }),
        item({ id: "633d282e-a1bb-4a36-b9cb-e3b51146a1b6", name: "Foregejo", url: "git.hu-tao.dev", colour: "secondary", glyph: "\uf335" }),
        item({ id: "75de1339-58a5-4b66-9c4c-ad0bb0c66831", name: "GitHub", url: "https://github.com", colour: "surfaceContainerHighest", glyph: "\uf09b" }),
        item({ id: "e91e66c8-82ac-4c04-8cb1-17feb53d6494", name: "Navidrome", url: "music.hu-tao.dev", colour: "primaryContainer", glyph: "\uf001" }),
        item({ id: "3f7ad348-45f4-48da-8905-f94d4f22adb0", name: "YouTube", url: "https://www.youtube.com", colour: "secondaryContainer", glyph: "\uf16a" }),
        item({ id: "cd7d5293-2993-42d3-980d-bf55ebbb2c3d", name: "Steam", url: "store.steampowered.com", colour: "secondaryContainer", glyph: "\uf1b6" }),
        item({ id: "ef1f55f8-3ec2-4147-b0fd-d7c3f1291a92", name: "Stremio", url: "web.stremio.com", colour: "primaryContainer", glyph: "\uf04b" }),
        item({ id: "a01791e8-17d6-4b27-9f85-a01d3ba676af", name: "Pixiv", url: "pixiv.net", colour: "secondaryContainer", glyph: "\uf00f" }),
        item({ id: "5c555ec7-e9fb-4bbb-aed3-d7492de54c1b", name: "Grafana", url: "grafana.hu-tao.dev", colour: "secondary", glyph: "\ue7f3" }),
        item({ id: "d438dcff-0ea7-418d-a6a3-c11b98388640", name: "Dozzle", url: "dozzle.hu-tao.dev", colour: "primary", glyph: "\u{f0bc2}" }),
      ],
      hidden: true,
    },
    fields: [
      { type: "presets", label: "Start from", presets: PRESETS },
      { type: "screen", label: "Bookmarks", hint: "Reorder them, or switch one off.", component: CtBookmarkList, props: (app) => ({ settings: app.settings.bookmarks }) },
      { key: "flow", label: "Flow", type: "switch", options: [["row", "Rows"], ["column", "Columns"]], hint: "Which way the tiles fill, gaps filled as they go." },
      { key: "count", label: "Columns", type: "number", min: 1, max: 12, when: (v) => v.flow !== "column" },
      { key: "count", label: "Rows", type: "number", min: 1, max: 12, when: (v) => v.flow === "column" },
      { key: "rowHeight", label: "Row height", type: "range", min: 2, max: 16, step: 0.25, unit: "rem" },
      { key: "gap", label: "Gap", type: "range", min: 0, max: 4, step: 0.25, unit: "rem" },
      { key: "placement", label: "Placement", type: "switch", options: [["floating", "Floating"], ["docked", "Docked"]], hint: "Floating, rounded like the menu with the page's padding under it; docked, flush with the window's bottom." },
      { key: "topLine", label: "Top line", type: "checkbox" },
      { key: "topLineColour", label: "Line colour", type: "colour", when: (v) => v.topLine },
      { key: "dimHidden", label: "Show hidden bookmarks while editing", type: "checkbox" },
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
      {#if editing ? it.hidden && !settings.dimHidden : it.hidden}
        <!-- Off the page: not drawn at all. -->
      {:else if editing}
        <div
          role="listitem"
          class="ct-slot col-(--col) row-(--row) flex min-h-0 min-w-0 cursor-grab flex-col {dragging === i || it.hidden ? 'opacity-40' : ''} {over === i ? 'outline-3 outline-offset-3 outline-primary outline-dashed rounded-xl' : ''}"
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
