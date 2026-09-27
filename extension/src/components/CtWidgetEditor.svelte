<!-- One widget's properties and placement, from edit mode. Changes apply as
     they're made, like the settings panel. -->
<script lang="ts">
  import { PLACE } from "../fields.ts";
  import type { Widget } from "../store.svelte.ts";
  import { button, primary } from "../ui.ts";
  import { widgets } from "../widgets.ts";
  import CtDialog from "./CtDialog.svelte";
  import CtForm from "./CtForm.svelte";
  import CtTabs from "./CtTabs.svelte";

  let { widget, onclose }: { widget: Widget; onclose: () => void } = $props();
  const info = $derived(widgets.find((c) => c.name === widget.component)?.widget);
  let tab = $state(0);

</script>

<CtDialog title={info?.label ?? widget.component} {onclose}>
  <CtTabs tabs={["Properties", "Placement"]} bind:current={tab} />
  {#if tab === 0}
    {#if info?.fields.length}
      <CtForm fields={info.fields} values={widget.settings} />
    {:else}
      <p class="m-0">This widget has no properties.</p>
    {/if}
  {:else}
    <CtForm fields={PLACE} values={widget.place} />
  {/if}
  {#snippet footer()}
    <button type="button" class={button} onclick={() => ((widget.hidden = true), onclose())}>Hide it</button>
    <button type="button" class={primary} onclick={onclose}>Done</button>
  {/snippet}
</CtDialog>
