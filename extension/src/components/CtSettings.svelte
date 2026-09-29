<!-- Settings, docked to the window's right edge and not modal: the page moves
     over to stay in view beside it, so every change shows as it's made. It's
     also where every editor opens (app.focus): a part's settings from the
     pen, a bookmark. There are no pop-ups. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import type { Field } from "../fields.ts";
  import { COLOURS } from "../scheme.ts";
  import { complete, DEFAULTS, edit, type App } from "../store.svelte.ts";
  import { button, hint, iconButton, input, primary } from "../ui.ts";
  import { placeables, type Placeable } from "../widgets.ts";
  import CtForm from "./CtForm.svelte";
  import CtIcon from "./CtIcon.svelte";
  import CtPartEditor from "./CtPartEditor.svelte";
  import CtTabs from "./CtTabs.svelte";

  const app = getContext<App>("ct");
  let tab = $state(0);
  // Slides in from the edge it's docked to. |global: the {#if} that shows it
  // is App's, and a local transition only plays for its own block.
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const focus = $derived(app.focus);
  const title = $derived(typeof focus?.title === "function" ? focus.title() || "Untitled" : (focus?.title ?? "Settings"));
  const props = $derived(typeof focus?.props === "function" ? focus.props() : focus?.props);

  // The new tab's background and Tree Style Tab's sidebar take the same
  // choices; `none` is what "no background of ours" means for each.
  const backdrop = (label: string, none: string): Field[] => [
    {
      key: "source",
      label,
      type: "select",
      options: [
        ["wallpaper", "The caelestia wallpaper"],
        ["colour", "A colour"],
        ["none", none],
      ],
    },
    { key: "colour", label: "Colour", type: "colour", when: (v) => v.source === "colour" },
    { key: "dim", label: "Dim", type: "range", min: 0, max: 90, unit: "%", when: (v) => v.source !== "none" },
    { key: "blur", label: "Blur", type: "range", min: 0, max: 40, unit: "px", when: (v) => v.source === "wallpaper" },
  ];
  const BACKGROUND = backdrop("Background", "The scheme's background colour");
  const TST: Field[] = [
    ...backdrop("Sidebar", "Tree Style Tab's own"),
    // 0 is centred; the sidebar is narrow, so most of a wallpaper is off it.
    { key: "x", label: "X offset", type: "range", min: -100, max: 100, unit: "%", when: (v) => v.source === "wallpaper" },
    { key: "y", label: "Y offset", type: "range", min: -100, max: 100, unit: "%", when: (v) => v.source === "wallpaper" },
  ];
  const SITES_FIELDS: Field[] = [
    { key: "enabled", label: "Theme websites", type: "checkbox" },
    {
      key: "accent",
      label: "Accent",
      type: "select",
      options: [...COLOURS.slice(0, 3), ["mauve", "Mauve"], ["pink", "Pink"], ["red", "Red"], ["peach", "Peach"], ["green", "Green"], ["blue", "Blue"], ["lavender", "Lavender"]],
    },
  ];
  // A site of your own has no style of ours, so its domains are its only
  // addresses and its CSS is all it gets.
  const OWN: Field[] = [
    { key: "domains", label: "On", type: "textarea", rows: 3, hint: "Its domains, one per line: music.example.com …" },
    { key: "when", label: "Also on pages matching", type: "text", hint: "A CSS selector, checked once the page has loaded: the CSS applies wherever it matches." },
    { key: "css", label: "Your CSS", type: "textarea", rows: 8, hint: "The scheme is in var(--caelestia-*): background: var(--caelestia-surface) …" },
  ];
  const OVERRIDE: Field[] = [
    { key: "domains", label: "Also on", type: "textarea", rows: 3, hint: "More domains for this style, one per line." },
    { key: "when", label: "Also on pages matching", type: "text", hint: "A CSS selector, checked once the page has loaded: the style applies wherever it matches." },
    { key: "css", label: "Your CSS", type: "textarea", rows: 6, hint: "Applied after the style, on the same pages. The scheme is in var(--caelestia-*)." },
  ];
  // Websites: the vendored styles, filterable, each with its override.
  let styles: { id: string; name: string }[] = $state([]);
  let filter = $state("");
  fetch("/userstyles/index.json")
    .then((r) => r.json())
    .then((index) => (styles = index.styles));
  const typed = $derived(filter.trim());
  const shown = $derived([...styles, ...app.settings.sites.custom].filter((s) => s.name.toLowerCase().includes(typed.toLowerCase())));
  const mine = (id: string) => app.settings.sites.custom.some((s) => s.id === id);
  // The one open, to open a site just added.
  let expanded = $state("");
  // A site of your own, named as typed: added and opened.
  function addSite() {
    if (!typed) return;
    const id = `custom-${crypto.randomUUID()}`;
    app.settings.sites.custom.push({ id, name: typed });
    app.settings.sites.overrides[id] = { domains: "", when: "", css: "" };
    expanded = id;
  }
  function removeSite(id: string) {
    const s = app.settings.sites;
    if (!confirm(`Remove ${s.custom.find((c) => c.id === id)?.name ?? "this site"} and its CSS?`)) return;
    s.custom = s.custom.filter((c) => c.id !== id);
    delete s.overrides[id];
    s.off = s.off.filter((x) => x !== id);
  }
  // Created when a site is first opened, not while rendering the list.
  const open = (id: string) => (app.settings.sites.overrides[id] ??= { domains: "", when: "", css: "" });
  function toggle(id: string, on: boolean) {
    const off = app.settings.sites.off;
    app.settings.sites.off = on ? off.filter((x) => x !== id) : [...off, id];
  }

  // Ours first, then the user's; typed so svelte-check doesn't widen the
  // tuple's second element to Placeable[] | Placeable[] and lose the union.
  const groups: [string, Placeable[]][] = [
    ["Ours", placeables.filter((c) => c.ours)],
    ["Yours", placeables.filter((c) => !c.ours)],
  ];

  const ALL = { origins: ["<all_urls>"] };
  let allowed: boolean | null = $state(null);
  browser.permissions.contains(ALL).then((v: boolean) => (allowed = v));

  // Advanced: every setting as JSON.
  let json = $state(JSON.stringify(app.settings, null, 2));
  function apply() {
    try {
      app.settings = complete(JSON.parse(json));
    } catch (e) {
      alert(`Not valid JSON: ${(e as Error).message}`);
    }
  }
  function reset() {
    if (!confirm("Reset every setting and bookmark to the defaults?")) return;
    app.settings = complete(structuredClone(DEFAULTS));
    json = JSON.stringify(app.settings, null, 2);
  }
</script>

<aside
  class="ct-settings fixed inset-y-0 right-0 z-10 box-border w-[min(30rem,100vw)] overflow-auto bg-surface-container p-6 text-on-surface shadow-[0_0_2rem_color-mix(in_srgb,var(--caelestia-shadow)_40%,transparent)]"
  aria-label="Settings"
  transition:fly|global={{ x: "100%", opacity: 1, duration: still ? 0 : 260, easing: cubicOut }}
>
  <header class="mb-4 flex items-center gap-2">
    {#if app.focus}
      <button type="button" class={iconButton} title="Back to settings" onclick={() => (app.focus = null)}><CtIcon name="left" /></button>
    {/if}
    <h2 class="m-0 min-w-0 flex-1 truncate text-2xl font-normal">{title}</h2>
    <button type="button" class={iconButton} title="Close" onclick={() => ((app.focus = null), (app.panel = false))}><CtIcon name="close" /></button>
  </header>
  {#if focus}
    <!-- The editor's props come from `focus`, not app.focus: closing an editor
         nulls app.focus while its handler (a remove, say) is still running. -->
    <focus.component {...props} onclose={() => (app.focus = null)} />
  {:else}
  <CtTabs tabs={["General", "Components", "Background", "Websites", "Browser", "Advanced"]} bind:current={tab} />

  {#if tab === 0}
    <div class="grid gap-4">
      <CtForm fields={[{ key: "font", label: "Font", type: "font", hint: "The whole page's, unless a part sets its own." }]} values={app.settings} />
      <CtForm
        fields={[
          { key: "tied", label: "Same on every side", type: "checkbox" },
          { key: "x", label: "Padding", type: "range", min: 0, max: 6, step: 0.25, unit: "rem", when: (v) => v.tied },
          { key: "x", label: "Horizontal", type: "range", min: 0, max: 6, step: 0.25, unit: "rem", when: (v) => !v.tied },
          { key: "y", label: "Vertical", type: "range", min: 0, max: 6, step: 0.25, unit: "rem", when: (v) => !v.tied },
        ]}
        values={app.settings.padding}
      />
      <p class="m-0 {hint}">
        The clock, the toolbar, the bookmarks, the menu and each of its tabs are edited from the page (turn on the pen and pick one) or from Components.
      </p>
    </div>
  {:else if tab === 1}
    <!-- A row's toggle shows or hides it; the rest of the row opens its
         settings, the pen's form. Hidden rows are greyed. -->
    <div class="grid gap-6">
      {#each groups as [heading, list] (heading)}
        <div class="grid gap-1" role="group" aria-labelledby="ct-components-{heading}">
          <h3 id="ct-components-{heading}" class="m-0 mb-1 text-lg font-medium">{heading}</h3>
          {#each list as c (c.name)}
            <div class="flex items-center gap-2 rounded-xl px-3 py-1.5 hover:bg-surface-container-high">
              <button
                type="button"
                class="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent py-1 text-left text-base {c.at(app.settings).hidden ? 'text-on-surface-variant/60' : 'text-on-surface'}"
                onclick={() => edit(app, c.label, CtPartEditor, () => ({ info: c.info, values: c.at(app.settings) }))}>{c.label}</button
              >
              <input
                type="checkbox"
                role="switch"
                class="m-0 size-4.5 cursor-pointer accent-primary"
                aria-label="Show {c.label}"
                checked={!c.at(app.settings).hidden}
                onchange={(e) => (c.at(app.settings).hidden = !e.currentTarget.checked)}
              />
            </div>
          {:else}
            <p class="m-0 {hint}">
              None yet. Yours go in <code>~/.config/caelestia-tab/components/</code>, then <code>npm run --prefix extension build</code>: see the handbook's Plugins guide.
            </p>
          {/each}
        </div>
      {/each}
    </div>
  {:else if tab === 2}
    <CtForm fields={BACKGROUND} values={app.settings.background} />
  {:else if tab === 3}
    <div class="grid gap-4">
      <p class="m-0">
        Recolours sites with catppuccin/userstyles, compiled against the live scheme. Your own Stylus styles and userscripts get the same colours as
        <code>var(--caelestia-primary)</code> and friends, and a <code>caelestia-scheme</code> event on <code>document</code> when they change.
      </p>
      {#if allowed === false}
        <p class="m-0 flex flex-wrap items-center gap-2">
          Needs permission to run on all sites.
          <!-- request() must run inside the click, before anything is awaited. -->
          <button type="button" class={primary} onclick={() => browser.permissions.request(ALL).then((v: boolean) => (allowed = v))}>Allow</button>
        </p>
      {/if}
      <CtForm fields={SITES_FIELDS} values={app.settings.sites} />
      <input
        type="search"
        class={input}
        placeholder="Filter sites, or name one of your own"
        aria-label="Filter sites"
        bind:value={filter}
        onkeydown={(e) => e.key === "Enter" && (e.preventDefault(), addSite())}
      />
      <div class="grid gap-1">
        {#each shown as s (s.id)}
          <details
            class="rounded-xl open:bg-surface-container-high open:p-3"
            open={expanded === s.id}
            ontoggle={(e) => {
              if (e.currentTarget.open) open(s.id);
              else if (expanded === s.id) expanded = "";
            }}
          >
            <summary class="flex cursor-pointer items-center gap-2 py-1">
              <input
                type="checkbox"
                class="m-0 size-4.5 accent-primary"
                checked={!app.settings.sites.off.includes(s.id)}
                onclick={(e) => e.stopPropagation()}
                onchange={(e) => toggle(s.id, e.currentTarget.checked)}
              />
              {s.name}
            </summary>
            {#if app.settings.sites.overrides[s.id]}
              <div class="pt-3"><CtForm fields={mine(s.id) ? OWN : OVERRIDE} values={app.settings.sites.overrides[s.id]} /></div>
            {/if}
            {#if mine(s.id)}
              <button type="button" class="{button} mt-3" onclick={() => removeSite(s.id)}>Remove this site</button>
            {/if}
          </details>
        {/each}
        {#if typed}
          <!-- Enter in the filter does the same. -->
          <button type="button" class="{button} flex items-center gap-2 text-left" onclick={addSite}>
            <CtIcon name="add" />Add “{typed}”, a site of your own
          </button>
        {/if}
      </div>
    </div>
  {:else if tab === 4}
    <h3 class="mt-0 text-lg font-medium">Tree Style Tab</h3>
    <p>Themes Tree Style Tab's sidebar like the new tab's background, and follows scheme switches live. Needs Tree Style Tab installed; nothing happens without it.</p>
    <CtForm fields={TST} values={app.settings.treeStyleTab} />
  {:else}
    <div class="grid gap-4">
      <h3 class="m-0 text-lg font-medium">Status</h3>
      <p class="m-0">
        {#if app.scheme}
          Connected. Scheme {app.scheme.name} {app.scheme.flavour}, {app.scheme.mode}.
        {:else}
          Not connected{app.helperError ? `: ${app.helperError}` : ""}. Install the helper and run caelestia-tab install, then restart the browser.
        {/if}
      </p>
      <CtForm
        fields={[
          { key: "css", label: "Custom CSS", type: "textarea", hint: "Applied to this page after its own styles. The scheme is in var(--caelestia-*)." },
          { key: "panel", label: "Settings panel", type: "text", hint: "The component that draws this panel: CtSettings, or one of yours. Ctrl+, opens it." },
        ]}
        values={app.settings}
      />
      <h3 class="m-0 text-lg font-medium">All settings</h3>
      <textarea class="{input} font-mono text-sm" rows="12" spellcheck="false" bind:value={json}></textarea>
      <div class="flex flex-wrap gap-2">
        <button type="button" class={button} onclick={apply}>Apply</button>
        <button type="button" class={button} onclick={() => (json = JSON.stringify(app.settings, null, 2))}>Reload</button>
        <button type="button" class={button} onclick={reset}>Reset everything</button>
      </div>
    </div>
  {/if}
  {/if}
</aside>
