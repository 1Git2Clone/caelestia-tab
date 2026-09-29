<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";

  export const widget: WidgetInfo = {
    label: "Toolbar",
    defaults: { side: "end", actions: true, edit: true, settings: true },
    fields: [
      {
        key: "side",
        label: "Side",
        type: "select",
        hint: "Where it sits on the bar. The menu's tabs take the other side, or the left when it's in the middle.",
        options: [
          ["start", "Left"],
          ["center", "Middle"],
          ["end", "Right"],
        ],
      },
      { key: "actions", label: "The bookmarks' +", type: "checkbox" },
      { key: "edit", label: "The pen, for edit mode", type: "checkbox" },
      { key: "settings", label: "Settings", type: "checkbox", hint: "Without it, Ctrl+, still opens them." },
    ],
    hideHint: "Settings open with Ctrl+, without it, and Components there shows it again.",
  };
</script>

<!-- The pill of buttons on the bar: the bookmarks' +, the pen for edit mode
     and the settings. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { App } from "../../store.svelte.ts";
  import CtIcon from "../CtIcon.svelte";
  import { widget as bookmarks } from "./CtBookmarks.svelte";

  let { settings }: { settings: any } = $props();
  const app = getContext<App>("ct");
  const base = "grid cursor-pointer place-items-center rounded-full border-0 px-3 py-2 text-lg";
  const off = `${base} bg-transparent text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)]`;
  const on = `${base} bg-primary text-on-primary`;
</script>

<!-- On glass of its own, always: over the open menu it's a shade darker,
     but taking it away when the menu opens left it bare while the panel was
     still growing in. -->
<nav class="ct-toolbar flex gap-0.5 rounded-full bg-glass p-1 backdrop-blur-md">
  {#if settings.actions}
    {#each bookmarks.actions ?? [] as a (a.title)}
      <button type="button" class={off} title={a.title} aria-label={a.title} onclick={() => a.run(app.settings.bookmarks, app)}><CtIcon name={a.icon} /></button>
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
