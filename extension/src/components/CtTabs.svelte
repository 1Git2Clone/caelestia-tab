<script lang="ts">
  let { tabs, current = $bindable(0) }: { tabs: string[]; current?: number } = $props();
</script>

<div role="tablist" class="ct-tabs mb-6 flex flex-wrap justify-between gap-1 rounded-3xl bg-surface-container-highest p-1">
  {#each tabs as tab, i (tab)}
    <button
      type="button"
      role="tab"
      aria-selected={current === i}
      class="cursor-pointer rounded-full border-0 px-4 py-2 {current === i ? 'bg-primary text-on-primary' : 'bg-transparent text-on-surface'}"
      onclick={() => (current = i)}>{tab}</button
    >
  {/each}
</div>
