<!-- A font-family with autocomplete: the installed fonts (the helper lists
     them) filtered as you type, each shown in its own font. Arrow keys move,
     Enter picks, Escape closes the list. Any text is accepted, for a font the
     helper doesn't know or a whole font-family list. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { App } from "../store.svelte.ts";
  import { hint as hintClass, input } from "../ui.ts";

  let { label, hint, value = $bindable("") }: { label: string; hint?: string; value: string } = $props();
  const app = getContext<App>("ct");
  const uid = $props.id();
  const list = `${uid}-fonts`;

  let open = $state(false);
  let active = $state(0);
  const matches = $derived.by(() => {
    const q = (value ?? "").trim().toLowerCase();
    const all = app.fonts;
    // Names starting with what's typed first, then the ones containing it.
    const starts = all.filter((f) => f.toLowerCase().startsWith(q));
    const contains = q ? all.filter((f) => !f.toLowerCase().startsWith(q) && f.toLowerCase().includes(q)) : [];
    return [...starts, ...contains].slice(0, 60);
  });

  function pick(font: string) {
    value = font;
    open = false;
  }
  function onkeydown(e: KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) open = true;
    if (e.key === "ArrowDown") active = Math.min(active + 1, matches.length - 1);
    else if (e.key === "ArrowUp") active = Math.max(active - 1, 0);
    else if (e.key === "Enter" && open && matches[active]) pick(matches[active]);
    else if (e.key === "Escape" && open) {
      // Only the list: the panel's own Escape shouldn't fire as well.
      e.stopPropagation();
      open = false;
      return;
    } else return;
    e.preventDefault();
  }
  $effect(() => {
    void value;
    active = 0;
  });
</script>

<div class="relative grid gap-1.5">
  <label for="{uid}-input">{label}</label>
  <input
    id="{uid}-input"
    type="text"
    role="combobox"
    aria-expanded={open}
    aria-controls={list}
    aria-autocomplete="list"
    autocomplete="off"
    spellcheck="false"
    class="{input} font-(family-name:--font)"
    style:--font={value ? `${value}, var(--ct-font)` : null}
    placeholder="Default"
    bind:value
    onfocus={() => (open = true)}
    oninput={() => (open = true)}
    onblur={() => setTimeout(() => (open = false), 150)}
    {onkeydown}
  />
  {#if open && matches.length}
    <ul id={list} role="listbox" class="absolute inset-x-0 top-full z-20 m-0 mt-1 max-h-64 list-none overflow-auto rounded-xl bg-surface-container-highest p-1 shadow-lg">
      {#each matches as font, i (font)}
        <li role="option" aria-selected={i === active}>
          <button
            type="button"
            tabindex="-1"
            class="w-full cursor-pointer truncate rounded-lg border-0 px-3 py-1.5 text-left font-(family-name:--font) {i === active ? 'bg-primary text-on-primary' : 'bg-transparent text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)]'}"
            style:--font={`"${font}"`}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => pick(font)}>{font}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
  {#if !app.fonts.length}
    <small class={hintClass}>Type a font's name. Your installed fonts are offered once the helper is connected and up to date.</small>
  {:else if hint}
    <small class={hintClass}>{hint}</small>
  {/if}
</div>
