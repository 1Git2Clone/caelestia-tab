<!-- A user component, for the UI tests: it's built in from this folder
     (CAELESTIA_TAB_COMPONENTS), imports from $ct, and takes a setting. -->
<script module lang="ts">
  import type { WidgetInfo } from "$ct/fields.ts";

  export const widget: WidgetInfo = {
    label: "Hello",
    defaults: { who: "world" },
    fields: [{ key: "who", label: "Greet", type: "text" }],
  };
</script>

<script lang="ts">
  let { settings }: { settings: any } = $props();
</script>

<p class="hello m-0 rounded-2xl bg-glass p-4 text-on-surface">Hello, {settings.who}</p>
