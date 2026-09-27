<!-- One widget's properties and placement, in the side panel, from edit
     mode. Changes apply as they're made. -->
<script lang="ts">
  import { PLACE } from "../fields.ts";
  import { getContext } from "svelte";
  import type { App, Widget } from "../store.svelte.ts";
  import { button } from "../ui.ts";
  import { widgets } from "../widgets.ts";
  import CtForm from "./CtForm.svelte";
  import CtTabs from "./CtTabs.svelte";

  let { widget, onclose }: { widget: Widget; onclose: () => void } = $props();
  const info = $derived(widgets.find((c) => c.name === widget.component)?.widget);
  let tab = $state(0);
  const app = getContext<App>("ct");

  function remove() {
    if (!confirm(`Remove this ${info?.label ?? widget.component} and its settings?`)) return;
    onclose();
    app.settings.widgets.splice(app.settings.widgets.indexOf(widget), 1);
  }
</script>

<label class="mb-4 flex cursor-pointer items-center gap-2.5">
  <input type="checkbox" class="m-0 size-4.5 accent-primary" checked={!widget.hidden} onchange={(e) => (widget.hidden = !e.currentTarget.checked)} />
  <span>Show on the page</span>
</label>
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
<div class="mt-6 flex gap-2">
  <button type="button" class={button} onclick={remove}>Remove this widget</button>
</div>
