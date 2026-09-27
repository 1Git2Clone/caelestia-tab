<!-- The page: a CSS grid the user defines (settings.layout), with each widget
     placed on it. In edit mode every widget gets its overlay: its own
     component's, or CtEditOverlay. Each widget's wrapper is marked with the
     window edges it touches (layout.ts edges). -->
<script lang="ts">
  import { getContext } from "svelte";
  import { edges } from "../layout.ts";
  import type { App } from "../store.svelte.ts";
  import { widgets } from "../widgets.ts";
  import CtEditOverlay from "./CtEditOverlay.svelte";

  const app = getContext<App>("ct");
  const L = $derived(app.settings.layout);
  const JUSTIFY = { start: "justify-self-start", center: "justify-self-center", end: "justify-self-end", stretch: "justify-self-stretch" };
  const ALIGN = { start: "self-start", center: "self-center", end: "self-end", stretch: "self-stretch" };
</script>

<main
  class="ct-page relative z-1 box-border grid min-h-screen grid-cols-(--cols) grid-rows-(--rows) gap-(--gap) p-(--pad) [grid-template-areas:var(--areas)] {app.panel
    ? 'mr-[min(30rem,100vw)]'
    : ''}"
  style:--cols={L.columns}
  style:--rows={L.rows}
  style:--areas={L.areas}
  style:--gap={L.gap}
  style:--pad={L.padding}
>
  {#each app.settings.widgets as w (w.id)}
    {@const c = widgets.find((c) => c.name === w.component)}
    <!-- A hidden widget stays in edit mode, faded, so the pen can bring it back. -->
    {#if c && (!w.hidden || app.editing)}
      {@const Overlay = c.widget.overlay === false ? null : (c.widget.overlay ?? CtEditOverlay)}
      <section
        class="ct-widget ct-widget-{w.id} relative min-w-0 [grid-area:var(--area)] {JUSTIFY[w.place.justify]} {ALIGN[w.place.align]} {w.hidden ? 'opacity-40' : ''}"
        style:--area={w.place.area}
        use:edges
      >
        <c.component id={w.id} settings={w.settings} editing={app.editing} />
        {#if app.editing && Overlay}<Overlay widget={w} {app} />{/if}
      </section>
    {:else if !c && app.editing}
      <!-- A widget whose component isn't in this build (a user component built
           without, say): kept, with its settings, and shown in edit mode so
           it can be removed. -->
      <section class="ct-widget relative min-w-0 [grid-area:var(--area)]" style:--area={w.place.area}>
        <p class="m-0 rounded-2xl bg-glass p-4 text-on-surface-variant">No component called {w.component} in this build.</p>
        <CtEditOverlay widget={w} {app} />
      </section>
    {/if}
  {/each}
  {#if !app.scheme && app.helperError}
    <p class="col-span-full self-center justify-self-center rounded-2xl bg-error px-4 py-2.5 text-on-error">No colours yet: {app.helperError}. See Settings, Advanced.</p>
  {/if}
</main>
