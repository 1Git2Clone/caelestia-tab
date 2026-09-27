// The new tab's state: settings, the scheme and the wallpaper, all from
// storage.local. Every change to `app.settings` is saved as it happens, and
// every other tab's change (and the helper's) arrives here, so open tabs stay
// in step with each other and with caelestia.
import type { Component } from "svelte";
import { tstOptions, TREE_STYLE_TAB } from "./treestyletab.ts";
import type { Scheme } from "./types.ts";
import { SITES } from "./userstyles.ts";
import { widgets } from "./widgets.ts";

// Where a widget sits on the page's grid: any grid-area value (an area's
// name, or 1 / 1 / 2 / 3), and its alignment in that cell.
export interface Place {
  area: string;
  justify: "start" | "center" | "end" | "stretch";
  align: "start" | "center" | "end" | "stretch";
}

export interface Widget {
  id: string;
  // The component's name: CtClock, CtBookmarks, or a user component's.
  component: string;
  hidden?: boolean;
  place: Place;
  settings: Record<string, any>;
}

export interface Settings {
  // The page is a CSS grid the user defines; widgets are placed on it.
  layout: { columns: string; rows: string; areas: string; gap: string; padding: string };
  // The page's font, CSS font-family; empty for the default.
  font: string;
  // The component that draws the settings panel.
  panel: string;
  background: { source: "wallpaper" | "colour" | "none"; colour: string; dim: number; blur: number };
  widgets: Widget[];
  sites: typeof SITES;
  treeStyleTab: typeof TREE_STYLE_TAB;
  css: string;
}

export interface App {
  settings: Settings;
  scheme: Scheme | null;
  helperError: string | null;
  // A blob: URL of the caelestia wallpaper, when there is one.
  wallpaper: string | null;
  // Installed font families, from the helper; empty without it.
  fonts: string[];
  // The helper's other plugins' values, by topic (github, media …).
  data: Record<string, any>;
  editing: boolean;
  panel: boolean;
  // What the side panel is editing instead of its tabs: a component and its
  // props (a widget's properties, one bookmark). There are no pop-ups: every
  // editor is a view in the panel, beside the page, applying as it changes.
  focus: { title: string; component: Component<any>; props: Record<string, any> } | null;
}

export const DEFAULTS: Settings = {
  layout: {
    columns: "minmax(0, 1fr)",
    rows: "auto 1fr auto",
    areas: '"toolbar" "clock" "bookmarks"',
    gap: "2rem",
    padding: "1rem 2.5rem 0",
  },
  font: "",
  panel: "CtSettings",
  background: { source: "wallpaper", colour: "surfaceContainer", dim: 20, blur: 0 },
  widgets: [
    { id: "toolbar", component: "CtToolbar", place: { area: "toolbar", justify: "end", align: "start" }, settings: {} },
    { id: "clock", component: "CtClock", place: { area: "clock", justify: "center", align: "center" }, settings: {} },
    { id: "bookmarks", component: "CtBookmarks", place: { area: "bookmarks", justify: "stretch", align: "end" }, settings: {} },
  ],
  sites: SITES,
  treeStyleTab: TREE_STYLE_TAB,
  css: "",
};

// Settings saved before the Svelte rewrite name plugins, not components.
const RENAMED: Record<string, string> = { clock: "CtClock", bookmarks: "CtBookmarks" };

// Fills in what an older or partial settings object lacks: top-level keys,
// each widget's place and settings from its component's defaults, and the
// toolbar, which was part of the page before it was a widget.
export function complete(saved: any): Settings {
  const s: Settings = { ...structuredClone(DEFAULTS), ...saved };
  s.layout = { ...DEFAULTS.layout, ...s.layout };
  s.sites = { ...SITES, ...s.sites };
  s.treeStyleTab = tstOptions(s.treeStyleTab);
  s.background = { ...DEFAULTS.background, ...s.background };
  if (saved?.widgets && !saved.layout && !saved.widgets.some((w: any) => w.component === "CtToolbar")) {
    s.widgets = [structuredClone(DEFAULTS.widgets[0]), ...s.widgets];
  }
  s.widgets = s.widgets.map((w: any) => {
    const component = w.component ?? RENAMED[w.plugin] ?? w.plugin;
    const info = widgets.find((c) => c.name === component)?.widget;
    const fallback = DEFAULTS.widgets.find((d) => d.component === component)?.place;
    const { plugin: _, ...rest } = w;
    return {
      ...rest,
      component,
      place: { area: "auto", justify: "stretch", align: "start", ...fallback, ...info?.place, ...w.place },
      settings: { ...structuredClone(info?.defaults ?? {}), ...w.settings },
    };
  });
  return s;
}

const store = browser.storage.local;

// The helper's topics that widgets read through app.data.
const TOPICS = ["github", "media"];

// Opens an editor in the side panel.
export function edit(app: App, title: string, component: Component<any>, props: Record<string, any>) {
  app.focus = { title, component, props };
  app.panel = true;
}

// Sends a widget's command to one of the helper's plugins.
export const tell = (message: { topic: string; command: string; [k: string]: unknown }) => browser.runtime.sendMessage({ type: "helper", message }).catch(() => {});

export async function start(): Promise<App> {
  const got = await store.get(["settings", "scheme", "wallpaper", "helperError", "fonts", ...TOPICS]);
  const app: App = $state({
    settings: complete(got.settings),
    scheme: got.scheme ?? null,
    helperError: got.helperError ?? null,
    wallpaper: null,
    fonts: got.fonts ?? [],
    data: Object.fromEntries(TOPICS.map((t) => [t, got[t] ?? null])),
    editing: false,
    panel: false,
    focus: null,
  });
  wallpaper(app, got.wallpaper);

  // What this tab wrote and hasn't seen come back yet. A slider saves on every
  // step, and a step's echo can arrive after the next step was saved: taking
  // that echo for another tab's change would roll the value back.
  const pending = new Set<string>();
  let last = JSON.stringify(app.settings);
  $effect.root(() => {
    $effect(() => {
      const json = JSON.stringify(app.settings);
      if (json === last) return;
      last = json;
      pending.add(json);
      store.set({ settings: JSON.parse(json) });
    });
  });

  store.onChanged.addListener((changes: any) => {
    if (changes.scheme) app.scheme = changes.scheme.newValue ?? null;
    if (changes.wallpaper) wallpaper(app, changes.wallpaper.newValue);
    if (changes.helperError) app.helperError = changes.helperError.newValue ?? null;
    if (changes.fonts) app.fonts = changes.fonts.newValue ?? [];
    for (const t of TOPICS) if (changes[t]) app.data[t] = changes[t].newValue ?? null;
    if (changes.settings) {
      const json = JSON.stringify(changes.settings.newValue ?? null);
      if (pending.delete(json) || json === last) return;
      app.settings = complete(changes.settings.newValue ?? {});
      last = JSON.stringify(app.settings);
    }
  });

  // Keeps the background, and with it the helper, running while this tab is open.
  browser.runtime.connect({ name: "newtab" });
  return app;
}

// A blob URL rather than the data URL itself, so the page's style doesn't
// carry a string the size of the image.
async function wallpaper(app: App, value: { url: string } | undefined) {
  if (app.wallpaper) URL.revokeObjectURL(app.wallpaper);
  app.wallpaper = value ? URL.createObjectURL(await (await fetch(value.url)).blob()) : null;
}
