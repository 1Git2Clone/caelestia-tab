// The new tab's state: settings, the scheme and the wallpaper, all from
// storage.local. Every change to `app.settings` is saved as it happens, and
// every other tab's change (and the helper's) arrives here, so open tabs stay
// in step with each other and with caelestia.
import type { Component } from "svelte";
import { TREE_STYLE_TAB } from "./treestyletab.ts";
import type { Scheme } from "./types.ts";
import { SITES } from "./userstyles.ts";
import { widgets } from "./widgets.ts";

export interface Widget {
  id: string;
  // The component's name: CtClock, CtBookmarks, or a user component's.
  component: string;
  hidden?: boolean;
  settings: Record<string, any>;
}

export interface Settings {
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
  editing: boolean;
  panel: boolean;
  // The open modal, if any: a component and its props. It gets an onclose.
  dialog: { component: Component<any>; props: Record<string, any> } | null;
}

export const DEFAULTS: Settings = {
  background: { source: "wallpaper", colour: "surfaceContainer", dim: 20, blur: 0 },
  widgets: [
    { id: "clock", component: "CtClock", settings: {} },
    { id: "bookmarks", component: "CtBookmarks", settings: {} },
  ],
  sites: SITES,
  treeStyleTab: TREE_STYLE_TAB,
  css: "",
};

// Settings saved before the Svelte rewrite name plugins, not components.
const RENAMED: Record<string, string> = { clock: "CtClock", bookmarks: "CtBookmarks" };

// Fills in what an older or partial settings object lacks: top-level keys,
// and each widget's settings from its component's defaults.
export function complete(saved: any): Settings {
  const s: Settings = { ...structuredClone(DEFAULTS), ...saved };
  s.sites = { ...SITES, ...s.sites };
  s.treeStyleTab = { ...TREE_STYLE_TAB, ...s.treeStyleTab };
  s.background = { ...DEFAULTS.background, ...s.background };
  s.widgets = s.widgets.map((w: any) => {
    const component = w.component ?? RENAMED[w.plugin] ?? w.plugin;
    const defaults = widgets.find((c) => c.name === component)?.widget.defaults ?? {};
    const { plugin: _, ...rest } = w;
    return { ...rest, component, settings: { ...structuredClone(defaults), ...w.settings } };
  });
  return s;
}

const store = browser.storage.local;

export async function start(): Promise<App> {
  const got = await store.get(["settings", "scheme", "wallpaper", "helperError"]);
  const app: App = $state({
    settings: complete(got.settings),
    scheme: got.scheme ?? null,
    helperError: got.helperError ?? null,
    wallpaper: null,
    editing: false,
    panel: false,
    dialog: null,
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
