<!-- The top of the page: a bar with the menu button, the menu's tabs and the
     toolbar, and under it the clock, or the open tab laid over the clock's
     place. The clock isn't drawn while a tab covers it, so nothing hidden can
     be edited. Opening grows the panel out of the menu button and closing
     shrinks it back in; a tab slides in from the side it sits on. Whether it's
     open, and on which tab, is a setting: a new tab opens as the last was left. -->
<script module lang="ts">
  import type { WidgetInfo } from "../fields.ts";

  // The menu's own settings are where it's open and on which tab; the pen
  // edits the menu as a whole.
  export const widget: WidgetInfo = { label: "Menu", defaults: {}, fields: [] };
</script>

<script lang="ts">
  import { getContext } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";
  import type { App } from "../store.svelte.ts";
  import { menu as menuInfo, parts, tabs } from "../widgets.ts";
  import CtEditOverlay from "./CtEditOverlay.svelte";
  import CtClock from "./widgets/CtClock.svelte";
  import CtToolbar from "./widgets/CtToolbar.svelte";

  const app = getContext<App>("ct");
  const menu = $derived(app.settings.menu);
  const side = $derived(app.settings.toolbar.side);
  // The tabs take the side the toolbar doesn't, the left when it's in the
  // middle. On the right they're mirrored, so the menu button is always at
  // the page's edge.
  const right = $derived(side === "start");
  // Tabs hidden from their pen or from Settings › Components are off the bar.
  const shown = $derived(tabs.filter((t) => !menu.tabs[t.name]?.hidden));
  const current = $derived(shown.find((t) => t.name === menu.tab) ?? shown[0]);
  const open = $derived(menu.open && !menu.hidden);
  const toolbar = $derived(app.settings.toolbar);

  // No motion for those who asked for none.
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ms = (n: number) => (still ? 0 : n);

  // Which way a tab slides in: from where it sits relative to the last one.
  let dir = $state(1);
  function pick(name: string) {
    const from = shown.findIndex((t) => t.name === menu.tab);
    const to = shown.findIndex((t) => t.name === name);
    dir = (to >= from ? 1 : -1) * (right ? -1 : 1);
    menu.tab = name;
  }

  // The panel grows out of the menu button: its centre, from the section's
  // corner, is the scale's origin.
  let section: HTMLElement | undefined = $state();
  let button: HTMLElement | undefined = $state();
  let origin = $state("0 0");
  function toggle() {
    if (section && button) {
      const s = section.getBoundingClientRect();
      const b = button.getBoundingClientRect();
      origin = `${b.left + b.width / 2 - s.left}px ${b.top + b.height / 2 - s.top}px`;
    }
    menu.open = !menu.open;
  }
  let bar = $state(0);

  const tabButton = (on: boolean) =>
    `flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border-0 px-3 text-base ${on ? "bg-primary text-on-primary" : "bg-transparent text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)]"}`;
</script>

<section bind:this={section} class="ct-menu relative flex min-h-0 min-w-0 flex-col">
  {#if open}
    <div
      class="ct-menu-panel absolute inset-0 flex origin-(--origin) flex-col overflow-hidden rounded-2xl bg-glass text-on-surface backdrop-blur-[10px]"
      style:--origin={origin}
      transition:scale={{ start: 0.05, opacity: 0, duration: ms(280), easing: cubicOut }}
    >
      <div class="h-(--bar) shrink-0 border-0 border-b border-solid border-outline-variant" style:--bar="{bar}px"></div>
      <div class="relative min-h-0 flex-1">
        {#key current?.name}
          <div
            class="ct-tab absolute inset-0 overflow-auto p-4"
            in:fly={{ x: 48 * dir, duration: ms(220), easing: cubicOut }}
            out:fly={{ x: -48 * dir, duration: ms(220), easing: cubicOut }}
          >
            {#if current}<current.component settings={menu.tabs[current.name]} />{/if}
          </div>
        {/key}
        {#key current?.name}
          <!-- Keyed by name: hiding the tab open in this pen moves `current`
               on, and an unkeyed `at` would keep pointing at whichever tab is
               current instead of the one this editor is for (2026-09-30). -->
          {#if app.editing && current}{@const name = current.name}<CtEditOverlay info={current.tab} at={(s) => s.menu.tabs[name]} />{/if}
        {/key}
      </div>
    </div>
  {/if}
  {#if app.editing && open}<CtEditOverlay info={menuInfo} at={(s) => s.menu} />{/if}

  {#if !menu.hidden || !toolbar.hidden}
    <!-- Two columns, the toolbar's sized to it, or three with it in the middle. -->
    <nav
      bind:clientHeight={bar}
      class="relative z-2 grid items-center gap-2 p-2 {{ start: 'grid-cols-[auto_minmax(0,1fr)]', center: 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]', end: 'grid-cols-[minmax(0,1fr)_auto]' }[side as 'end'] ?? 'grid-cols-[minmax(0,1fr)_auto]'}"
    >
      <!-- ponytail: tabs that don't fit their side are clipped; a scroll or an
           overflow menu when someone has that many. -->
      <div class="row-1 flex min-w-0 items-center gap-1 {open ? 'overflow-hidden' : ''} {right ? 'col-2 flex-row-reverse justify-self-end' : 'col-1'}">
        {#if !menu.hidden}
          <span class="relative">
            <button
              bind:this={button}
              type="button"
              class="{tabButton(false)} {menu.open ? '' : 'bg-glass backdrop-blur-md'}"
              title={menu.open ? "Close the menu" : "Open the menu"}
              aria-label={menu.open ? "Close the menu" : "Open the menu"}
              aria-expanded={menu.open}
              onclick={toggle}
            >
              <span class="font-glyph text-xl" aria-hidden="true">{""}</span>
            </button>
            {#if app.editing && !open}<CtEditOverlay info={menuInfo} at={(s) => s.menu} />{/if}
          </span>
        {/if}
        {#if open}
          {#each shown as t (t.name)}
            <span class="h-6 w-px shrink-0 bg-outline-variant" transition:fade={{ duration: ms(150) }}></span>
            <button
              type="button"
              class={tabButton(current?.name === t.name)}
              aria-pressed={current?.name === t.name}
              onclick={() => pick(t.name)}
              transition:fade={{ duration: ms(150) }}
            >
              <span class="font-glyph text-lg" aria-hidden="true">{t.tab.glyph}</span>{t.tab.label}
            </button>
          {/each}
        {/if}
      </div>
      {#if !toolbar.hidden}
        <div class="relative row-1 {{ start: 'col-1', center: 'col-2 justify-self-center', end: 'col-2 justify-self-end' }[side as 'end'] ?? 'col-2 justify-self-end'}">
          <CtToolbar settings={app.settings.toolbar} />
          {#if app.editing}<CtEditOverlay info={parts.toolbar} at={(s) => s.toolbar} />{/if}
        </div>
      {/if}
    </nav>
  {/if}

  {#if !open && !app.settings.clock.hidden}
    <!-- Centred on the whole section, not the space under the bar: padded by
         the bar's own height on both sides so the clock's centre is the
         section's centre, not riding up under the bar on a short page. -->
    <div
      class="pointer-events-none absolute inset-0 grid place-items-center py-(--bar)"
      style:--bar="{bar}px"
      in:fade={{ duration: ms(200), delay: ms(120) }}
    >
      <div class="ct-part relative pointer-events-auto">
        <CtClock settings={app.settings.clock} />
        {#if app.editing}<CtEditOverlay info={parts.clock} at={(s) => s.clock} />{/if}
      </div>
    </div>
  {/if}
</section>
