<script lang="ts">
  import type { Field } from "../fields.ts";
  import { button, hint, input } from "../ui.ts";
  import CtColour from "./CtColour.svelte";
  import CtFontPicker from "./CtFontPicker.svelte";
  import CtGlyphPicker from "./CtGlyphPicker.svelte";
  import CtImage from "./CtImage.svelte";

  let { field, values }: { field: Field; values: Record<string, any> } = $props();
</script>

{#snippet note(text?: string)}
  {#if text}<small class={hint}>{text}</small>{/if}
{/snippet}

{#if field.type === "presets"}
  <div class="grid gap-1.5">
    <span>{field.label}</span>
    <div class="flex flex-wrap gap-2">
      {#each field.presets as p (p.label)}
        <button type="button" class={button} onclick={() => Object.assign(values, structuredClone(p.values))}>{p.label}</button>
      {/each}
    </div>
    {@render note(field.hint)}
  </div>
{:else if field.type === "checkbox"}
  <div class="grid gap-1">
    <label class="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" class="m-0 size-4.5 accent-primary" bind:checked={values[field.key]} />
      <span>{field.label}</span>
    </label>
    {@render note(field.hint)}
  </div>
{:else if field.type === "select"}
  <label class="grid gap-1.5">
    <span>{field.label}</span>
    <select class={input} bind:value={values[field.key]}>
      {#each field.options as [value, label] (value)}
        <option {value}>{label}</option>
      {/each}
    </select>
    {@render note(field.hint)}
  </label>
{:else if field.type === "range"}
  <label class="grid gap-1.5">
    <span>{field.label} <output class="text-primary">{values[field.key]}{field.unit ?? ""}</output></span>
    <input type="range" class="m-0 accent-primary" min={field.min} max={field.max} step={field.step ?? 1} bind:value={values[field.key]} />
    {@render note(field.hint)}
  </label>
{:else if field.type === "number"}
  <label class="grid gap-1.5">
    <span>{field.label}</span>
    <input type="number" class={input} min={field.min} max={field.max} step={field.step} bind:value={values[field.key]} />
    {@render note(field.hint)}
  </label>
{:else if field.type === "textarea"}
  <label class="grid gap-1.5">
    <span>{field.label}</span>
    <textarea class="{input} font-mono text-sm" rows={field.rows ?? 8} spellcheck="false" bind:value={values[field.key]}></textarea>
    {@render note(field.hint)}
  </label>
{:else if field.type === "colour"}
  <CtColour label={field.label} hint={field.hint} bind:value={values[field.key]} />
{:else if field.type === "image"}
  <CtImage label={field.label} hint={field.hint} bind:value={values[field.key]} />
{:else if field.type === "glyph"}
  <CtGlyphPicker label={field.label} hint={field.hint} words={field.words?.(values) ?? []} bind:value={values[field.key]} />
{:else if field.type === "font"}
  <CtFontPicker label={field.label} hint={field.hint} bind:value={values[field.key]} />
{:else}
  <label class="grid gap-1.5">
    <span>{field.label}</span>
    <input type={field.type} class={input} placeholder={field.placeholder ?? ""} bind:value={values[field.key]} />
    {@render note(field.hint)}
  </label>
{/if}
