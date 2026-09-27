<!-- The page's backdrop: the caelestia wallpaper or a colour, dimmed towards
     the scheme's background and optionally blurred. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { cssColour } from "../scheme.ts";
  import type { App } from "../store.svelte.ts";

  const app = getContext<App>("ct");
  const bg = $derived(app.settings.background);
</script>

<div
  class="ct-background fixed inset-0 scale-105 bg-(--colour) bg-(image:--wallpaper) bg-cover bg-center blur-(--blur)"
  data-ct-wallpaper={bg.source === "wallpaper" ? "" : undefined}
  style:--wallpaper={bg.source === "wallpaper" && app.wallpaper ? `url("${app.wallpaper}")` : "none"}
  style:--colour={bg.source === "colour" ? cssColour(bg.colour) : "var(--caelestia-background)"}
  style:--blur="{bg.blur}px"
>
  <div class="absolute inset-0 bg-background opacity-(--dim)" style:--dim={bg.dim / 100}></div>
</div>
