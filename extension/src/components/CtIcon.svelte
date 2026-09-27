<script lang="ts">
  import { PATHS } from "../icons.ts";

  let { name }: { name: string } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" class="ct-icon block size-[1.25em] fill-current">
  <path d={PATHS[name as keyof typeof PATHS]} />
</svg>
