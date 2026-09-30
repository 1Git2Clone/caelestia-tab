<script lang="ts">
  let { tabs, current = $bindable(0) }: { tabs: string[]; current?: number } = $props();
  // Equal columns, each tab centred in its own, so the tabs are evenly
  // spaced and every row lines up. A wrapping flex row can't, since each row
  // spreads by its own tabs' widths.
  const cols = $derived(Math.min(tabs.length, 3));
</script>

<div role="tablist" class="ct-tabs mb-6 grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-1 rounded-3xl bg-surface-container-highest p-1" style:--cols={cols}>
  {#each tabs as tab, i (tab)}
    <button
      type="button"
      role="tab"
      aria-selected={current === i}
      class="cursor-pointer justify-self-center rounded-full border-0 px-4 py-2 {current === i ? 'bg-primary text-on-primary' : 'bg-transparent text-on-surface'}"
      onclick={() => (current = i)}>{tab}</button
    >
  {/each}
</div>
