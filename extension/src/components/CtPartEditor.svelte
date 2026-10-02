<!-- One part's settings (the clock, the toolbar, a menu tab …), in the side
     panel, from edit mode or Settings › Components. Changes apply as they're
     made. Hide is every part's, last. -->
<script lang="ts">
  import type { WidgetInfo } from "../fields.ts";
  import CtForm from "./CtForm.svelte";

  let { info, values }: { info: WidgetInfo; values: Record<string, any>; onclose?: () => void } = $props();
  const fields = $derived([...info.fields, { key: "hidden", label: "Hide", type: "checkbox" as const, hint: info.hideHint }]);
</script>

<CtForm {fields} {values} />
