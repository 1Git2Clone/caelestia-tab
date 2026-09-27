<!-- Edits one bookmark (index), or adds one (-1), on a copy: nothing changes
     until Save. -->
<script lang="ts">
  import type { Field } from "../fields.ts";
  import { words } from "../glyphs.ts";
  import { button, primary } from "../ui.ts";
  import CtDialog from "./CtDialog.svelte";
  import CtForm from "./CtForm.svelte";
  import CtTabs from "./CtTabs.svelte";
  import CtTile from "./CtTile.svelte";
  import { item } from "./widgets/CtBookmarks.svelte";

  let { settings, index, onclose }: { settings: any; index: number; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const draft = $state(structuredClone(index < 0 ? item({ name: "New bookmark" }) : $state.snapshot(settings.items[index])));
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
    ["Address", [{ key: "url", label: "URL", type: "url", placeholder: "https://example.com" }]],
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

  function save() {
    draft.url = draft.url.trim();
    if (!draft.url) {
      tab = 1;
      alert("A bookmark needs a URL.");
      return;
    }
    if (!/^[a-z][\w+.-]*:/i.test(draft.url)) draft.url = `https://${draft.url}`;
    const it = $state.snapshot(draft);
    if (index < 0) settings.items.push(it);
    else settings.items[index] = it;
    onclose();
  }
</script>

<CtDialog title={index < 0 ? "Add a bookmark" : `Edit ${settings.items[index]?.name ?? ""}`} {onclose}>
  <CtTabs tabs={TABS.map(([t]) => t)} bind:current={tab} />
  <div class="flex flex-col-reverse items-start gap-8 md:flex-row">
    <div class="w-full min-w-0 flex-1">
      <CtForm fields={TABS[tab][1]} values={draft} />
    </div>
    <div class="sticky top-0 grid w-full grid-rows-[auto_9.5rem] justify-items-stretch gap-2 text-primary md:w-60">
      <small class="text-center">Preview</small>
      <CtTile it={draft} link={false} />
    </div>
  </div>
  {#snippet footer()}
    <button type="button" class={button} onclick={onclose}>Cancel</button>
    <button type="button" class={primary} onclick={save}>Save</button>
  {/snippet}
</CtDialog>
