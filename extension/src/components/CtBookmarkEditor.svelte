<!-- One bookmark, in the side panel. It edits the tile itself, so every change
     shows on the page as it's made; there's nothing to save. -->
<script lang="ts">
  import type { Field } from "../fields.ts";
  import { words } from "../glyphs.ts";
  import { button } from "../ui.ts";
  import CtForm from "./CtForm.svelte";
  import CtTabs from "./CtTabs.svelte";

  let { settings, index, onclose }: { settings: any; index: number; onclose: () => void } = $props();
  const it = $derived(settings.items[index]);
  let tab = $state(0);

  const TABS: [string, Field[]][] = [
    [
      "Look",
      [
        { key: "name", label: "Name", type: "text" },
        { key: "showName", label: "Show the name", type: "checkbox" },
        {
          key: "glyph",
          label: "Glyph",
          type: "glyph",
          words: (v) => words(v.url, v.name),
          hint: "A Nerd Font glyph, shown instead of the letters. Suggestions follow the address and the name.",
        },
        { key: "letter", label: "Letters", type: "text", hint: "Without a glyph: a short label or an emoji. Empty uses the name's first two letters." },
        { key: "showLetter", label: "Show the glyph or letters", type: "checkbox" },
        { key: "image", label: "Image", type: "image", hint: "Covers the tile. Without one, the tile is its colour." },
        { key: "colour", label: "Colour", type: "colour", hint: "Fills the tile when it has no image. A scheme colour follows the scheme." },
      ],
    ],
    ["Address", [{ key: "url", label: "URL", type: "url", placeholder: "https://example.com", hint: "Without a scheme, https:// is assumed." }]],
    [
      "Layout",
      [
        { key: "width", label: "Width, in columns", type: "number", min: 1, max: 24 },
        { key: "height", label: "Height, in rows", type: "number", min: 1, max: 24 },
        { key: "column", label: "grid-column", type: "text", placeholder: "span 2, 1 / 3, 2 / -1 …", hint: "Any grid-column value. Overrides the width." },
        { key: "row", label: "grid-row", type: "text", placeholder: "span 2, 1 / 3 …", hint: "Any grid-row value. Overrides the height." },
      ],
    ],
  ];

  function remove() {
    if (!confirm(`Remove ${it.name || "this bookmark"}?`)) return;
    onclose();
    settings.items.splice(index, 1);
  }
</script>

{#if it}
  <CtTabs tabs={TABS.map(([t]) => t)} bind:current={tab} />
  <CtForm fields={TABS[tab][1]} values={it} />
  <div class="mt-6 flex gap-2">
    <button type="button" class={button} onclick={remove}>Remove</button>
  </div>
{/if}
