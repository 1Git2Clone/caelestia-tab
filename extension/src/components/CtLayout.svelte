<!-- The widgets, down the page in settings order with the last at the bottom.
     Each sits in a section the size of the widget, marked with the window
     edges it touches (layout.ts edges). -->
<script lang="ts">
  import { getContext } from "svelte";
  import { edges } from "../layout.ts";
  import type { App } from "../store.svelte.ts";
  import { widgets } from "../widgets.ts";

  const app = getContext<App>("ct");
</script>

<main class="ct-widgets relative z-1 box-border flex min-h-screen flex-col justify-end gap-8 px-4 pt-18 sm:px-10 sm:pt-20 {app.panel ? 'mr-[min(30rem,100vw)]' : ''}">
  {#each app.settings.widgets as w (w.id)}
    {@const c = widgets.find((c) => c.name === w.component)}
    {#if c && !w.hidden}
      <section class="ct-widget ct-widget-{w.id} {c.widget.section ?? ''}" use:edges>
        <c.component settings={w.settings} editing={app.editing} />
      </section>
    {/if}
  {/each}
  {#if !app.scheme && app.helperError}
    <p class="self-center rounded-2xl bg-error px-4 py-2.5 text-on-error">No colours yet: {app.helperError}. See Settings, Advanced.</p>
  {/if}
</main>
