<!-- One bookmark: a link filled with a scheme colour or an image, with its
     letters or glyph and its name. -->
<script lang="ts">
  import { cssColour, onColour } from "../scheme.ts";

  // `slot`: in edit mode, with the control bar under it, so square at the bottom.
  let { it, link = true, slot = false }: { it: any; link?: boolean; slot?: boolean } = $props();
  const mark = $derived(it.glyph || it.letter || it.name.trim().slice(0, 2));
  const hover =
    "transition-[translate,box-shadow] duration-150 hover:-translate-y-[3px] hover:shadow-[0_0.5rem_1.25rem_color-mix(in_srgb,var(--caelestia-shadow)_45%,transparent)] focus-visible:-translate-y-[3px] focus-visible:outline-none";
  // On an image the labels take the accent, over a soft shade to stay legible.
  const image =
    "bg-(image:--image) text-primary before:absolute before:inset-x-0 before:top-[40%] before:bottom-0 before:bg-linear-to-b before:from-transparent before:to-[color-mix(in_srgb,var(--caelestia-background)_65%,transparent)] before:content-['']";
</script>

<svelte:element
  this={link ? "a" : "div"}
  href={link ? it.url : undefined}
  class="ct-tile relative box-border flex min-w-0 items-end gap-2.5 overflow-hidden border-0 border-solid border-primary bg-(--tile) bg-cover bg-center bg-no-repeat px-3.5 py-2.5 text-(--on-tile) no-underline
    {slot ? 'min-h-0 flex-1 rounded-t-xl' : 'rounded-xl border-b-3'} {link ? hover : ''} {it.image ? image : ''}"
  style:--tile={cssColour(it.colour)}
  style:--on-tile={cssColour(onColour(it.colour))}
  style:--image={it.image ? `url(${JSON.stringify(it.image)})` : undefined}
>
  {#if it.showLetter}
    <span class="ct-mark relative leading-none {it.glyph ? 'font-glyph text-3xl' : 'text-2xl font-semibold'}">{mark}</span>
  {/if}
  {#if it.showName}
    <span class="ct-name relative truncate text-lg">{it.name}</span>
  {/if}
</svelte:element>
