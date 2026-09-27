<!-- One settings field. The label names the control and nothing else; a hint
     describes it (aria-describedby), and a slider's value sits beside it, so
     assistive tech, and tests, find a field by its label alone. -->
<script lang="ts">
  import type { Field } from "../fields.ts";
  import { button, hint, input } from "../ui.ts";
  import CtColour from "./CtColour.svelte";
  import CtFontPicker from "./CtFontPicker.svelte";
  import CtGlyphPicker from "./CtGlyphPicker.svelte";
  import CtImage from "./CtImage.svelte";

  let { field, values }: { field: Field; values: Record<string, any> } = $props();
  const uid = $props.id();
  const described = $derived(field.hint ? `${uid}-hint` : undefined);
</script>

{#snippet note(text?: string)}
  {#if text}<small id="{uid}-hint" class={hint}>{text}</small>{/if}
{/snippet}

{#if field.type === "presets"}
  <div class="grid gap-1.5" role="group" aria-labelledby="{uid}-label">
    <span id="{uid}-label">{field.label}</span>
    <div class="flex flex-wrap gap-2">
      {#each field.presets as p (p.label)}
        <button type="button" class={button} onclick={() => Object.assign(values, structuredClone(p.values))}>{p.label}</button>
      {/each}
    </div>
    {@render note(field.hint)}
  </div>
{:else if field.type === "checkbox"}
  <div class="grid gap-1">
    <div class="flex items-center gap-2.5">
      <input id={uid} type="checkbox" class="m-0 size-4.5 cursor-pointer accent-primary" aria-describedby={described} bind:checked={values[field.key]} />
      <label for={uid} class="cursor-pointer">{field.label}</label>
    </div>
    {@render note(field.hint)}
  </div>
{:else if field.type === "select"}
  <div class="grid gap-1.5">
    <label for={uid}>{field.label}</label>
    <select id={uid} class={input} aria-describedby={described} bind:value={values[field.key]}>
      {#each field.options as [value, label] (value)}
        <option {value}>{label}</option>
      {/each}
    </select>
    {@render note(field.hint)}
  </div>
{:else if field.type === "range"}
  <div class="grid gap-1.5">
    <div><label for={uid}>{field.label}</label> <output for={uid} class="text-primary">{values[field.key]}{field.unit ?? ""}</output></div>
    <input id={uid} type="range" class="m-0 accent-primary" min={field.min} max={field.max} step={field.step ?? 1} aria-describedby={described} bind:value={values[field.key]} />
    {@render note(field.hint)}
  </div>
{:else if field.type === "number"}
  <div class="grid gap-1.5">
    <label for={uid}>{field.label}</label>
    <input id={uid} type="number" class={input} min={field.min} max={field.max} step={field.step} aria-describedby={described} bind:value={values[field.key]} />
    {@render note(field.hint)}
  </div>
{:else if field.type === "textarea"}
  <div class="grid gap-1.5">
    <label for={uid}>{field.label}</label>
    <textarea id={uid} class="{input} font-mono text-sm" rows={field.rows ?? 8} spellcheck="false" aria-describedby={described} bind:value={values[field.key]}></textarea>
    {@render note(field.hint)}
  </div>
{:else if field.type === "colour"}
  <CtColour label={field.label} hint={field.hint} bind:value={values[field.key]} />
{:else if field.type === "image"}
  <CtImage label={field.label} hint={field.hint} bind:value={values[field.key]} />
{:else if field.type === "glyph"}
  <CtGlyphPicker label={field.label} hint={field.hint} words={field.words?.(values) ?? []} bind:value={values[field.key]} />
{:else if field.type === "font"}
  <CtFontPicker label={field.label} hint={field.hint} bind:value={values[field.key]} />
{:else}
  <div class="grid gap-1.5">
    <label for={uid}>{field.label}</label>
    <input id={uid} type={field.type} class={input} placeholder={field.placeholder ?? ""} aria-describedby={described} bind:value={values[field.key]} />
    {@render note(field.hint)}
  </div>
{/if}
