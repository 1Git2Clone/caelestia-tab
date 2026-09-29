// The new tab's state: settings, the scheme and the wallpaper, all from
// storage.local. Every change to `app.settings` is saved as it happens, and
// every other tab's change (and the helper's) arrives here, so open tabs stay
// in step with each other and with caelestia.
import type { Component } from "svelte";
import { stable } from "./json.ts";
import { tstOptions, TREE_STYLE_TAB } from "./treestyletab.ts";
import type { Scheme } from "./types.ts";
import { SITES } from "./userstyles.ts";
import { parts, tabs } from "./widgets.ts";

export interface Settings {
  // The page's font, CSS font-family; empty for the default.
  font: string;
  // The page's padding, rem: `x` left and right, `y` top and bottom, or
  // `x` all round while tied.
  padding: { tied: boolean; x: number; y: number };
  // The component that draws the settings panel.
  panel: string;
  background: { source: "wallpaper" | "colour" | "none"; colour: string; dim: number; blur: number };
  // The page is fixed: the bar (the menu's tabs, the toolbar), the clock or
  // the open tab under it, and the bookmarks. Each part's settings:
  clock: Record<string, any>;
  toolbar: Record<string, any>;
  bookmarks: Record<string, any>;
  // Whether the menu is open and on which tab (kept, so a new tab opens as
  // the last one was left), and each tab's settings, by its component's name.
  // `hidden` takes the button and the panel, not the clock.
  menu: { open: boolean; tab: string; tabs: Record<string, Record<string, any>>; hidden?: boolean };
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
  // props (a part's settings, one bookmark). There are no pop-ups: every
  // editor is a view in the panel, beside the page, applying as it changes.
  // `title` can be a function, for a title that follows what's being edited,
  // and `props` should be: a function that finds what's edited in
  // app.settings each time, since app.settings is replaced whole when
  // another tab or the settings file changes it, and an editor holding the
  // old objects would edit nothing anyone sees.
  focus: { title: string | (() => string); component: Component<any>; props: Record<string, any> | (() => Record<string, any>) } | null;
}

export const DEFAULTS: Settings = {
  font: "",
  padding: { tied: true, x: 2.5, y: 2.5 },
  panel: "CtSettings",
  background: { source: "wallpaper", colour: "surfaceContainer", dim: 20, blur: 0 },
  clock: {},
  toolbar: {},
  bookmarks: {},
  menu: { open: false, tab: "", tabs: {} },
  sites: SITES,
  treeStyleTab: TREE_STYLE_TAB,
  css: "",
};

// Settings saved before the Svelte rewrite name plugins, not components.
const RENAMED: Record<string, string> = { clock: "CtClock", bookmarks: "CtBookmarks" };

// Fills in what an older or partial settings object lacks: top-level keys,
// each part's and each tab's settings from its defaults. Settings from when
// the page was a grid of widgets (`widgets`, `layout`) keep each part's
// settings, and the menu widget's, and drop the placement.
export function complete(saved: any): Settings {
  const s: Settings = { ...structuredClone(DEFAULTS), ...saved };
  s.sites = { ...structuredClone(SITES), ...s.sites };
  s.treeStyleTab = tstOptions(s.treeStyleTab);
  s.background = { ...DEFAULTS.background, ...s.background };
  s.padding = { ...DEFAULTS.padding, ...s.padding };
  s.menu = { ...structuredClone(DEFAULTS.menu), ...s.menu };
  if (Array.isArray(saved?.widgets)) {
    const find = (c: string) => saved.widgets.find((w: any) => (w.component ?? RENAMED[w.plugin] ?? w.plugin) === c)?.settings;
    s.clock = { ...find("CtClock"), ...saved.clock };
    s.toolbar = { ...find("CtToolbar"), ...saved.toolbar };
    s.bookmarks = { ...find("CtBookmarks"), ...saved.bookmarks };
    const menu = find("Menu");
    if (menu && !saved.menu) {
      s.menu.open = !!menu.open;
      s.menu.tab = { github: "CtGitHub", media: "CtMedia" }[menu.tab as string] ?? "";
      s.menu.tabs.CtGitHub = { searches: menu.searches, limit: menu.limit };
      s.menu.tabs.CtMedia = { lyrics: menu.lyrics };
    }
  }
  delete (s as any).widgets;
  delete (s as any).layout;
  for (const [key, info] of Object.entries(parts)) {
    s[key as "clock"] = { ...structuredClone(info.defaults), ...s[key as "clock"] };
  }
  // Bookmarks from before the line under a tile was a setting.
  s.bookmarks.items = (s.bookmarks.items ?? []).map((it: any) => ({ line: "auto", lineColour: "primary", ...it }));
  for (const t of tabs) {
    s.menu.tabs[t.name] = { ...structuredClone(t.tab.defaults), ...s.menu.tabs[t.name] };
  }
  if (!tabs.some((t) => t.name === s.menu.tab)) s.menu.tab = tabs[0]?.name ?? "";
  return s;
}

const store = browser.storage.local;

// The helper's topics that widgets read through app.data.
const TOPICS = ["github", "media", "lyrics"];

// Opens an editor in the side panel.
export function edit(app: App, title: string | (() => string), component: Component<any>, props: Record<string, any> | (() => Record<string, any>)) {
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
  let last = stable(app.settings);
  $effect.root(() => {
    $effect(() => {
      const json = stable(app.settings);
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
      // Compared whole and key order aside: replacing app.settings with the
      // same settings would still leave every open editor holding the old
      // objects.
      const next = complete(changes.settings.newValue ?? {});
      const json = stable(next);
      if (pending.delete(stable(changes.settings.newValue ?? null)) || json === last) return;
      app.settings = next;
      last = json;
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
  performance.mark("ct-wallpaper");
}
