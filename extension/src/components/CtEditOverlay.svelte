<!-- Edit mode's default overlay on a widget: its name, and a button that
     opens its properties and placement. A widget can bring its own instead
     (WidgetInfo.overlay). -->
<script lang="ts">
  import type { App, Widget } from "../store.svelte.ts";
  import { widgets } from "../widgets.ts";
  import CtIcon from "./CtIcon.svelte";
  import CtWidgetEditor from "./CtWidgetEditor.svelte";

  let { widget, app }: { widget: Widget; app: App } = $props();
  const label = $derived(widgets.find((c) => c.name === widget.component)?.widget.label ?? widget.component);
</script>

<div class="pointer-events-none absolute inset-0 rounded-2xl outline-2 outline-offset-2 outline-primary outline-dashed">
  <button
    type="button"
    class="pointer-events-auto absolute -top-3.5 left-3 flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-primary px-3 py-1 text-sm text-on-primary shadow-md"
    title="Edit {label}"
    onclick={() => (app.dialog = { component: CtWidgetEditor, props: { widget } })}
  >
    <CtIcon name="edit" />{label}
  </button>
</div>
