<!-- The pill in the top corner: each shown widget's actions, the pen for
     edit mode and the settings. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { App } from "../store.svelte.ts";
  import { widgets } from "../widgets.ts";
  import CtIcon from "./CtIcon.svelte";

  const app = getContext<App>("ct");
  const base = "grid cursor-pointer place-items-center rounded-full border-0 px-3 py-2 text-lg";
  const off = `${base} bg-transparent text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)]`;
  const on = `${base} bg-primary text-on-primary`;
</script>

<nav class="ct-toolbar fixed top-4 z-2 flex gap-0.5 rounded-full bg-glass p-1 backdrop-blur-md {app.panel ? 'right-[calc(min(30rem,100vw)+1rem)]' : 'right-4'}">
  {#each app.settings.widgets as w (w.id)}
    {#if !w.hidden}
      {#each widgets.find((c) => c.name === w.component)?.widget.actions ?? [] as a (a.title)}
        <button type="button" class={off} title={a.title} aria-label={a.title} onclick={() => a.run(w.settings, app)}><CtIcon name={a.icon} /></button>
      {/each}
    {/if}
  {/each}
  <button type="button" class={app.editing ? on : off} title={app.editing ? "Done editing" : "Edit"} aria-pressed={app.editing} onclick={() => (app.editing = !app.editing)}>
    <CtIcon name="edit" />
  </button>
  <button type="button" class={app.panel ? on : off} title="Settings" aria-pressed={app.panel} onclick={() => (app.panel = !app.panel)}><CtIcon name="settings" /></button>
</nav>
