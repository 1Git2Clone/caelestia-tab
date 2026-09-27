<!-- A scheme colour, named under its swatch, or a fixed one from the
     browser's own colour picker. -->
<script lang="ts">
  import { COLOURS, cssColour } from "../scheme.ts";
  import { hint as hintClass } from "../ui.ts";

  let { label, hint, value = $bindable() }: { label: string; hint?: string; value: string } = $props();
  const custom = $derived(value?.startsWith("#"));
  const ring = (on: boolean) => (on ? "border-on-surface" : "border-transparent");
</script>

<div class="grid gap-1.5">
  <span>{label}</span>
  <div class="flex flex-wrap gap-3" role="radiogroup" aria-label={label}>
    {#each COLOURS as [token, name] (token)}
      <button
        type="button"
        role="radio"
        aria-checked={value === token}
        class="grid w-20 cursor-pointer content-start justify-items-center gap-1 border-0 bg-transparent p-0 text-xs text-on-surface-variant"
        onclick={() => (value = token)}
      >
        <span class="box-border size-10 rounded-full border-3 border-solid {ring(value === token)} bg-(--swatch) shadow-[inset_0_0_0_1px_var(--caelestia-outline-variant)]" style:--swatch={cssColour(token)}></span>
        <span class="text-center leading-tight">{name}</span>
      </button>
    {/each}
    <label class="grid w-20 cursor-pointer content-start justify-items-center gap-1 text-xs text-on-surface-variant">
      <span
        class="relative box-border size-10 rounded-full border-3 border-solid {ring(custom)} {custom ? 'bg-(--swatch)' : 'bg-[conic-gradient(#f55,#fd5,#5f7,#5df,#75f,#f5d,#f55)]'}"
        style:--swatch={custom ? value : undefined}
      >
        <input type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" value={custom ? value : "#ff8866"} oninput={(e) => (value = e.currentTarget.value)} />
      </span>
      <span class="text-center leading-tight">Custom</span>
    </label>
  </div>
  {#if hint}<small class={hintClass}>{hint}</small>{/if}
</div>
