<script lang="ts">
  import { getContext } from "svelte";
  import type { Field } from "../fields.ts";
  import type { App } from "../store.svelte.ts";
  import { button, hint, input } from "../ui.ts";
  import CtColour from "./CtColour.svelte";
  import CtGlyphPicker from "./CtGlyphPicker.svelte";
  import CtImage from "./CtImage.svelte";

  let { field, values }: { field: Field; values: Record<string, any> } = $props();
  const app = getContext<App>("ct");
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
  <label class="grid gap-1.5">
    <span>{field.label}</span>
    <!-- Shown in the font it names, as a preview. -->
    <input type="text" class="{input} font-(family-name:--font)" list="ct-fonts" placeholder="Default" bind:value={values[field.key]} style:--font={values[field.key] || null} />
    {@render note(field.hint ?? (app.fonts.length ? undefined : "Type a font's name. The installed ones are offered once the helper is connected."))}
  </label>
  <!-- One list for every font field on the page; the same id each time. -->
  <datalist id="ct-fonts">
    {#each app.fonts as font (font)}<option value={font}></option>{/each}
  </datalist>
{:else}
  <label class="grid gap-1.5">
    <span>{field.label}</span>
    <input type={field.type} class={input} placeholder={field.placeholder ?? ""} bind:value={values[field.key]} />
    {@render note(field.hint)}
  </label>
{/if}
