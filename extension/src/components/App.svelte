<!-- The new tab. `app` is the whole state (store.svelte.ts), shared with every
     component through context; the same component renders ahead of time in the
     background (render.ts) from a plain copy of it. -->
<script lang="ts">
  import { setContext } from "svelte";
  import { cssVars } from "../scheme.ts";
  import type { App } from "../store.svelte.ts";
  import CtBackground from "./CtBackground.svelte";
  import CtLayout from "./CtLayout.svelte";
  import CtSettings from "./CtSettings.svelte";
  import CtToolbar from "./CtToolbar.svelte";

  let { app }: { app: App } = $props();
  // svelte-ignore state_referenced_locally
  setContext("ct", app);

  $effect(() => {
    document.documentElement.dataset.mode = app.scheme?.mode ?? "dark";
  });
  const Dialog = $derived(app.dialog?.component);
</script>

<svelte:head>
  <!-- The scheme, then the user's own CSS, which wins. -->
  {@html `<style id="ct-scheme">${app.scheme ? cssVars(app.scheme) : ""}</style><style id="ct-custom">${app.settings.css}</style>`}
</svelte:head>
<svelte:window onkeydown={(e) => e.key === "Escape" && !app.dialog && (app.panel = false)} />

<CtBackground />
<CtToolbar />
<CtLayout />
{#if app.panel}<CtSettings />{/if}
{#if Dialog}<Dialog {...app.dialog!.props} onclose={() => (app.dialog = null)} />{/if}
