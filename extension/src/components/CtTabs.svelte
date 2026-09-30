<script lang="ts">
  let { tabs, current = $bindable(0) }: { tabs: string[]; current?: number } = $props();
  // Equal columns, each tab centred in its own, so the tabs are evenly
  // spaced and every row lines up. A wrapping flex row can't, since each row
  // spreads by its own tabs' widths. As many columns as the widest tab fits,
  // then as few as keep that many rows, so 6 tabs go 3 and 3, never 4 and 2.
  let width = $state(0);
  let buttons: HTMLElement[] = $state([]);
  const cols = $derived.by(() => {
    // Read on every resize, so a font that loads late is counted too. The
    // bar's p-1 and gap-1 are 4px each.
    const widest = Math.max(1, ...buttons.map((b) => b?.offsetWidth ?? 0));
    const fit = Math.max(1, Math.min(tabs.length, Math.floor((width - 8 + 4) / (widest + 4))));
    return Math.ceil(tabs.length / Math.ceil(tabs.length / fit));
  });
</script>

<div
  role="tablist"
  class="ct-tabs mb-6 grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-1 rounded-3xl bg-surface-container-highest p-1"
  style:--cols={width ? cols : Math.min(tabs.length, 3)}
  bind:clientWidth={width}
>
  {#each tabs as tab, i (tab)}
    <button
      bind:this={buttons[i]}
      type="button"
      role="tab"
      aria-selected={current === i}
      class="cursor-pointer justify-self-center whitespace-nowrap rounded-full border-0 px-4 py-2 {current === i ? 'bg-primary text-on-primary' : 'bg-transparent text-on-surface'}"
      onclick={() => (current = i)}>{tab}</button
    >
  {/each}
</div>
