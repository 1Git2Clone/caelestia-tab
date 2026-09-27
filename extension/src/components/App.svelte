<!-- The new tab. `app` is the whole state (store.svelte.ts), shared with every
     component through context; the same component renders ahead of time in the
     background (render.ts) from a plain copy of it. -->
<script lang="ts">
  import { setContext } from "svelte";
  import { cssVars } from "../scheme.ts";
  import type { App } from "../store.svelte.ts";
  import { components } from "../widgets.ts";
  import CtBackground from "./CtBackground.svelte";
  import CtLayout from "./CtLayout.svelte";
  import CtSettings from "./CtSettings.svelte";

  let { app }: { app: App } = $props();
  // svelte-ignore state_referenced_locally
  setContext("ct", app);

  $effect(() => {
    document.documentElement.dataset.mode = app.scheme?.mode ?? "dark";
  });
  // The settings panel is a component like the rest; the setting names it.
  const Panel = $derived(components[app.settings.panel] ?? CtSettings);

  function keydown(e: KeyboardEvent) {
    // Escape steps back out of an editor first, then closes the panel.
    if (e.key === "Escape") {
      if (app.focus) app.focus = null;
      else app.panel = false;
    }
    // Settings are reachable even with no toolbar on the page.
    if (e.key === "," && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      app.panel = !app.panel;
    }
  }
</script>

<svelte:head>
  <!-- The scheme, then the user's own CSS, which wins. -->
  {@html `<style id="ct-scheme">${app.scheme ? cssVars(app.scheme) : ""}</style><style id="ct-custom">${app.settings.css}</style>`}
</svelte:head>
<svelte:window onkeydown={keydown} />

<!-- The page's font, for everything under it, the panel included. -->
<div class="contents font-(family-name:--ct-font)" style:--ct-font={app.settings.font || "var(--font-sans)"}>
  <CtBackground />
  <CtLayout />
  {#if app.panel}<Panel />{/if}
</div>
