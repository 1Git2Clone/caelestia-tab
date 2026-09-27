<!-- Nerd Font glyphs: suggestions for the bookmark, then every glyph, and a
     search by name. The full list is long, so it renders as you scroll. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { char, glyphNames, search, suggest, type Glyph } from "../glyphs.ts";
  import { hint as hintClass, iconButton, input } from "../ui.ts";
  import CtIcon from "./CtIcon.svelte";

  let { label, hint, words = [], value = $bindable("") }: { label: string; hint?: string; words?: string[]; value: string } = $props();

  const PAGE = 240;
  let index = $state<Record<string, string> | null>(null);
  let query = $state("");
  let shown = $state(PAGE);
  let sentinel: HTMLElement | undefined = $state();
  onMount(async () => (index = await glyphNames()));

  const all: Glyph[] = $derived(index ? Object.entries(index).map(([name, code]) => ({ name, code })) : []);
  const suggested = $derived(index ? suggest(index, words) : []);
  const results = $derived(index && query.trim() ? search(index, query, Infinity) : all);

  $effect(() => {
    void query;
    shown = PAGE;
  });
  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (shown += PAGE), { root: sentinel.parentElement });
    io.observe(sentinel);
    return () => io.disconnect();
  });
</script>

{#snippet glyph(g: Glyph)}
  <button
    type="button"
    title="nf-{g.name}"
    class="cursor-pointer rounded-lg border-0 py-2 font-glyph text-2xl {value === char(g.code) ? 'bg-primary text-on-primary' : 'bg-surface-container-highest hover:bg-primary hover:text-on-primary'}"
    onclick={() => (value = char(g.code))}>{char(g.code)}</button
  >
{/snippet}

<div class="grid gap-1.5">
  <span>{label}</span>
  <div class="flex items-center gap-2">
    <span class="min-w-11 text-center font-glyph text-3xl text-primary">{value}</span>
    <input type="search" class={input} placeholder="Search glyphs by name: github, folder, arrow …" bind:value={query} />
    {#if value}
      <button type="button" class={iconButton} title="Remove the glyph" onclick={() => (value = "")}><CtIcon name="close" /></button>
    {/if}
  </div>
  {#if !query.trim() && suggested.length}
    <small class={hintClass}>Suggested</small>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
      {#each suggested as g (g.name)}{@render glyph(g)}{/each}
    </div>
    <small class={hintClass}>All glyphs</small>
  {/if}
  <div class="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 overflow-auto">
    {#each results.slice(0, shown) as g (g.name)}{@render glyph(g)}{/each}
    <span bind:this={sentinel} class="col-span-full h-px"></span>
  </div>
  {#if index && query.trim() && !results.length}<small class={hintClass}>No glyph has that in its name.</small>{/if}
  {#if hint}<small class={hintClass}>{hint}</small>{/if}
</div>
