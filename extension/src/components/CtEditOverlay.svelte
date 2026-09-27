<!-- Edit mode's mark on a part of the page: an outline, and a chip that opens
     the part's settings in the side panel. Above everything (z-3). -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { WidgetInfo } from "../fields.ts";
  import { edit, type App } from "../store.svelte.ts";
  import CtIcon from "./CtIcon.svelte";
  import CtPartEditor from "./CtPartEditor.svelte";

  let { info, values }: { info: WidgetInfo; values: Record<string, any> } = $props();
  const app = getContext<App>("ct");
</script>

<div class="pointer-events-none absolute inset-0 z-3 rounded-2xl outline-2 outline-offset-2 outline-primary outline-dashed">
  <button
    type="button"
    class="pointer-events-auto absolute -top-3.5 left-3 flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-primary px-3 py-1 text-sm text-on-primary shadow-md"
    title="Edit {info.label}"
    onclick={() => edit(app, info.label, CtPartEditor, { info, values })}
  >
    <CtIcon name="edit" />{info.label}
  </button>
</div>
