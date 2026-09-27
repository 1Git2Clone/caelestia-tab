<!-- A line of text that scrolls sideways, round and round, when it's wider
     than its box, and sits still when it fits. Paused on hover, and still for
     those who asked for less motion. -->
<script lang="ts">
  let { text }: { text: string } = $props();
  let box = $state(0);
  let width = $state(0);
  const moving = $derived(width > box + 1);
</script>

<div class="w-full overflow-hidden whitespace-nowrap" bind:clientWidth={box}>
  <div
    class="inline-flex {moving ? 'animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none' : ''}"
    style:--speed="{Math.max(6, width / 40)}s"
  >
    <span class="shrink-0 {moving ? 'pr-12' : ''}" bind:clientWidth={width}>{text}</span>
    {#if moving}<span class="shrink-0 pr-12" aria-hidden="true">{text}</span>{/if}
  </div>
</div>
