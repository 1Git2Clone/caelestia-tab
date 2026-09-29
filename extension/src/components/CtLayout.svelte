<!-- The page, fixed: the menu (its bar with the toolbar, and the clock or the
     open tab under it) above the bookmarks. In edit mode each part gets the
     pen's outline and chip, which open its settings in the side panel. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { edges } from "../layout.ts";
  import type { App } from "../store.svelte.ts";
  import { parts } from "../widgets.ts";
  import CtEditOverlay from "./CtEditOverlay.svelte";
  import CtMenu from "./CtMenu.svelte";
  import CtBookmarks from "./widgets/CtBookmarks.svelte";

  const app = getContext<App>("ct");
  const pad = $derived(app.settings.padding);
  const y = $derived(pad.tied ? pad.x : pad.y);
  const marks = $derived(app.settings.bookmarks);
  // No bookmarks to show, and the menu takes the page; edit mode keeps an
  // empty list on it, so its pen box can add one.
  const shown = $derived(!marks.hidden && (marks.items.length > 0 || app.editing));
</script>

<main
  class="ct-page relative z-1 box-border grid h-screen {shown ? 'grid-rows-[minmax(0,1fr)_auto]' : 'grid-rows-[minmax(0,1fr)]'} gap-8 px-(--px) pt-(--pt) pb-(--pb) transition-[margin-right] duration-[260ms] ease-out motion-reduce:transition-none {app.panel
    ? 'mr-[min(30rem,100vw)]'
    : 'mr-0'}"
  style:--px="{pad.x}rem"
  style:--pt="{y}rem"
  style:--pb={shown && marks.placement === "docked" ? "0rem" : `${y}rem`}
>
  <CtMenu />
  {#if shown}
    <section class="ct-part relative min-w-0" use:edges>
      <CtBookmarks settings={app.settings.bookmarks} editing={app.editing} />
      {#if app.editing}<CtEditOverlay info={parts.bookmarks} at={(s) => s.bookmarks} />{/if}
    </section>
  {/if}
  {#if !app.scheme && app.helperError}
    <p class="absolute top-1/2 left-1/2 m-0 -translate-1/2 rounded-2xl bg-error px-4 py-2.5 text-on-error">No colours yet: {app.helperError}. See Settings, Advanced.</p>
  {/if}
</main>
