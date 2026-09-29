<!-- Every bookmark, one row: its glyph or letters, its name, a switch for
     showing it, and a handle to reorder it (drag, or Alt+Up/Down with any of
     its own controls focused). A row opens the same editor the tile's own
     Edit does, `back` to this list. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { type App } from "../store.svelte.ts";
  import CtIcon from "./CtIcon.svelte";
  import { editItem } from "./widgets/CtBookmarks.svelte";

  let { settings }: { settings: any; onclose?: () => void } = $props();
  const app = getContext<App>("ct");

  function move(from: number, to: number) {
    if (to < 0 || to >= settings.items.length || to === from) return;
    const [it] = settings.items.splice(from, 1);
    settings.items.splice(to, 0, it);
  }

  let dragging = $state(-1);
  // The drop position, not the index of whatever's currently rendered there:
  // once the preview below moves the dragged row under the pointer, further
  // dragover events would otherwise land on the dragged row itself and flip
  // the preview back and forth.
  let over = $state(-1);

  // The order to render in while dragging: the dragged item's real index
  // spliced out and back in at the drop position, so the rows between shift
  // to open a gap. Settings itself is untouched until the drop.
  const order = $derived.by(() => {
    const idx = settings.items.map((_: any, i: number) => i);
    if (dragging < 0 || over < 0 || dragging === over) return idx;
    idx.splice(over, 0, idx.splice(dragging, 1)[0]);
    return idx;
  });
</script>

<div role="list" class="grid gap-1">
  {#each order as idx, pos (idx)}
    {@const it = settings.items[idx]}
    <!-- The keydown only notices Alt+arrows from whichever of the row's own
         controls has focus; it doesn't make the row itself a control. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      role="listitem"
      class="flex items-center gap-2 rounded-xl px-3 py-1.5 hover:bg-surface-container-high {it.hidden ? 'text-on-surface-variant/60' : ''} {dragging === idx ? 'opacity-40' : ''}"
      ondragover={(e) => {
        if (!e.dataTransfer!.types.includes("text/x-caelestia-bookmark")) return;
        e.preventDefault();
        over = pos;
      }}
      ondragleave={() => over === pos && (over = -1)}
      ondrop={(e) => {
        e.preventDefault();
        move(dragging, over);
        dragging = over = -1;
      }}
      onkeydown={(e) => {
        if (!e.altKey) return;
        if (e.key === "ArrowUp") (e.preventDefault(), move(idx, idx - 1));
        else if (e.key === "ArrowDown") (e.preventDefault(), move(idx, idx + 1));
      }}
    >
      <span
        role="button"
        tabindex="0"
        class="grid cursor-grab place-items-center rounded-lg border-0 bg-transparent px-1.5 py-1 text-current hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_15%,transparent)]"
        title="Drag to move"
        aria-label="Drag to move {it.name || 'this bookmark'}"
        draggable="true"
        ondragstart={(e) => {
          e.dataTransfer!.setData("text/x-caelestia-bookmark", String(idx));
          e.dataTransfer!.effectAllowed = "move";
          dragging = idx;
        }}
        ondragend={() => (dragging = over = -1)}
      ><CtIcon name="drag" /></span>
      <button
        type="button"
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent py-1 text-left text-current"
        onclick={() => editItem(app, settings, idx, app.focus)}
      >
        <span class="leading-none {it.glyph ? 'font-glyph text-xl' : 'text-lg font-semibold'}">{it.glyph || it.letter || it.name.trim().slice(0, 2)}</span>
        <span class="min-w-0 flex-1 truncate">{it.name || "Untitled"}</span>
      </button>
      <input
        type="checkbox"
        role="switch"
        class="m-0 size-4.5 cursor-pointer accent-primary"
        aria-label="Show {it.name || 'this bookmark'}"
        checked={!it.hidden}
        onchange={(e) => (it.hidden = !e.currentTarget.checked)}
      />
    </div>
  {/each}
</div>
