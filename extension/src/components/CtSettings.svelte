<!-- Settings, docked to the window's right edge and not modal: the page moves
     over to stay in view beside it, so every change shows as it's made. It's
     also where every editor opens (app.focus): a widget's properties from the
     pen, a bookmark. There are no pop-ups. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { LAYOUT, type Field } from "../fields.ts";
  import { COLOURS } from "../scheme.ts";
  import { complete, DEFAULTS, edit, type App, type Widget } from "../store.svelte.ts";
  import { button, hint, iconButton, input, primary } from "../ui.ts";
  import { widgets } from "../widgets.ts";
  import CtForm from "./CtForm.svelte";
  import CtIcon from "./CtIcon.svelte";
  import CtTabs from "./CtTabs.svelte";
  import CtWidgetEditor from "./CtWidgetEditor.svelte";

  const app = getContext<App>("ct");
  let tab = $state(0);

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
  const TST = backdrop("Sidebar", "Tree Style Tab's own");
  const SITES_FIELDS: Field[] = [
    { key: "enabled", label: "Theme websites", type: "checkbox" },
    {
      key: "accent",
      label: "Accent",
      type: "select",
      options: [...COLOURS.slice(0, 3), ["mauve", "Mauve"], ["pink", "Pink"], ["red", "Red"], ["peach", "Peach"], ["green", "Green"], ["blue", "Blue"], ["lavender", "Lavender"]],
    },
  ];
  const OVERRIDE: Field[] = [
    { key: "domains", label: "Also on", type: "textarea", rows: 3, hint: "More domains for this style, one per line." },
    { key: "when", label: "Also on pages matching", type: "text", hint: "A CSS selector, checked once the page has loaded: the style applies wherever it matches." },
    { key: "css", label: "Your CSS", type: "textarea", rows: 6, hint: "Applied after the style, on the same pages. The scheme is in var(--caelestia-*)." },
  ];
  // A new widget goes on the page and straight into its editor, with the pen
  // on, so it can be placed where it should be.
  let adding = $state("CtBookmarks");
  function add() {
    const c = widgets.find((c) => c.name === adding)!;
    const widget: Widget = {
      id: crypto.randomUUID(),
      component: c.name,
      place: { area: "auto", justify: "stretch", align: "start", ...c.widget.place },
      settings: structuredClone(c.widget.defaults),
    };
    app.settings.widgets.push(widget);
    app.editing = true;
    edit(app, c.widget.label, CtWidgetEditor, { widget: app.settings.widgets.at(-1) });
  }

  // Websites: the vendored styles, filterable, each with its override.
  let styles: { id: string; name: string }[] = $state([]);
  let filter = $state("");
  fetch("/userstyles/index.json")
    .then((r) => r.json())
    .then((index) => (styles = index.styles));
  const shown = $derived(styles.filter((s) => s.name.toLowerCase().includes(filter.trim().toLowerCase())));
  // Created when a site is first opened, not while rendering the list.
  const open = (id: string) => (app.settings.sites.overrides[id] ??= { domains: "", when: "", css: "" });
  function toggle(id: string, on: boolean) {
    const off = app.settings.sites.off;
    app.settings.sites.off = on ? off.filter((x) => x !== id) : [...off, id];
  }

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
>
  <header class="mb-4 flex items-center gap-2">
    {#if app.focus}
      <button type="button" class={iconButton} title="Back to settings" onclick={() => (app.focus = null)}><CtIcon name="left" /></button>
    {/if}
    <h2 class="m-0 min-w-0 flex-1 truncate text-2xl font-normal">{app.focus?.title ?? "Settings"}</h2>
    <button type="button" class={iconButton} title="Close" onclick={() => ((app.focus = null), (app.panel = false))}><CtIcon name="close" /></button>
  </header>
  {#if app.focus}
    {@const Focus = app.focus.component}
    <Focus {...app.focus.props} onclose={() => (app.focus = null)} />
  {:else}
  <CtTabs tabs={["General", "Background", "Websites", "Browser", "Advanced"]} bind:current={tab} />

  {#if tab === 0}
    <div class="grid gap-4">
      <CtForm fields={[{ key: "font", label: "Font", type: "font", hint: "The whole page's, unless a widget sets its own." }]} values={app.settings} />
      <p class="m-0 {hint}">Each widget is edited from the page: turn on the pen and pick one.</p>
      <h3 class="m-0 text-lg font-medium">Layout</h3>
      <p class="m-0 {hint}">The page is a CSS grid, and each widget sits in one of its areas (its placement, from the pen).</p>
      <CtForm fields={LAYOUT} values={app.settings.layout} />
      <h3 class="m-0 text-lg font-medium">Add a widget</h3>
      <div class="flex gap-2">
        <select class={input} bind:value={adding} aria-label="Widget to add">
          {#each widgets as c (c.name)}<option value={c.name}>{c.widget.label}</option>{/each}
        </select>
        <button type="button" class={primary} onclick={add}>Add</button>
      </div>
    </div>
  {:else if tab === 1}
    <CtForm fields={BACKGROUND} values={app.settings.background} />
  {:else if tab === 2}
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
      <input type="search" class={input} placeholder="Filter sites" bind:value={filter} />
      <div class="grid gap-1">
        {#each shown as s (s.id)}
          <details class="rounded-xl open:bg-surface-container-high open:p-3" ontoggle={(e) => e.currentTarget.open && open(s.id)}>
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
              <div class="pt-3"><CtForm fields={OVERRIDE} values={app.settings.sites.overrides[s.id]} /></div>
            {/if}
          </details>
        {/each}
      </div>
    </div>
  {:else if tab === 3}
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
