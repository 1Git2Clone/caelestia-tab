<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";

  export const widget: WidgetInfo = {
    label: "Toolbar",
    place: { justify: "end", align: "start" },
    defaults: { actions: true, edit: true, settings: true },
    fields: [
      { key: "actions", label: "Widgets' buttons", type: "checkbox", hint: "Like the bookmarks' +." },
      { key: "edit", label: "The pen, for edit mode", type: "checkbox" },
      { key: "settings", label: "Settings", type: "checkbox", hint: "Without it, Ctrl+, still opens them." },
    ],
  };
</script>

<!-- The pill of buttons: each shown widget's actions, the pen for edit mode
     and the settings. A widget like any other, placed where the user wants,
     and drawn above the others (z-2): a widget laid over its area, like a
     menu, can't hide the way out of edit mode. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { App } from "../../store.svelte.ts";
  import { widgets } from "../../widgets.ts";
  import CtIcon from "../CtIcon.svelte";

  let { settings }: { settings: any } = $props();
  const app = getContext<App>("ct");
  const base = "grid cursor-pointer place-items-center rounded-full border-0 px-3 py-2 text-lg";
  const off = `${base} bg-transparent text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)]`;
  const on = `${base} bg-primary text-on-primary`;
</script>

<nav class="ct-toolbar relative z-2 flex gap-0.5 rounded-full bg-glass p-1 backdrop-blur-md">
  {#if settings.actions}
    {#each app.settings.widgets as w (w.id)}
      {#if !w.hidden}
        {#each widgets.find((c) => c.name === w.component)?.widget.actions ?? [] as a (a.title)}
          <button type="button" class={off} title={a.title} aria-label={a.title} onclick={() => a.run(w.settings, app)}><CtIcon name={a.icon} /></button>
        {/each}
      {/if}
    {/each}
  {/if}
  {#if settings.edit}
    <button type="button" class={app.editing ? on : off} title={app.editing ? "Done editing" : "Edit"} aria-pressed={app.editing} onclick={() => (app.editing = !app.editing)}>
      <CtIcon name="edit" />
    </button>
  {/if}
  {#if settings.settings}
    <button type="button" class={app.panel ? on : off} title="Settings" aria-pressed={app.panel} onclick={() => (app.panel = !app.panel)}><CtIcon name="settings" /></button>
  {/if}
</nav>
