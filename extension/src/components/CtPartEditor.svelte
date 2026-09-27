<!-- One part's settings (the clock, the toolbar, a menu tab …), in the side
     panel, from edit mode. Changes apply as they're made. -->
<script lang="ts">
  import type { WidgetInfo } from "../fields.ts";
  import CtForm from "./CtForm.svelte";

  let { info, values }: { info: WidgetInfo; values: Record<string, any>; onclose?: () => void } = $props();
</script>

{#if info.fields.length}
  <CtForm fields={info.fields} values={values} />
{:else}
  <p class="m-0">This has no settings.</p>
{/if}
