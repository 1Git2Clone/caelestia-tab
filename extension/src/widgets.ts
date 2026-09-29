// Every component, ours (components/, named Ct*) and, in a user build, the
// user's. The page's parts (clock, toolbar, bookmarks) export `widget`, their
// fields; a menu tab exports `tab` (see fields.ts). Any component can be
// named where settings take one (the settings panel).
import type { Component } from "svelte";
import type { TabInfo, WidgetInfo } from "./fields.ts";
import type { Settings } from "./store.svelte.ts";

type Module = { default: Component<any>; widget?: WidgetInfo; tab?: TabInfo };

// Not App: it imports this module, and the root is never named in settings.
const ours = import.meta.glob<Module>(["./components/*.svelte", "./components/*/*.svelte", "!./components/App.svelte"], { eager: true });
// The user's, from $user (vite.config.ts): empty when they have none.
const theirs = import.meta.glob<Module>("$user/**/*.svelte", { eager: true });
const all = { ...ours, ...theirs };

const name = (path: string) => path.split("/").at(-1)!.replace(/\.svelte$/, "");

export const components = Object.fromEntries(Object.entries(all).map(([path, m]) => [name(path), m.default]));

const info = (n: string) => Object.entries(ours).find(([path]) => name(path) === n)![1].widget!;
// The page's parts, by their key in the settings.
export const parts = { clock: info("CtClock"), toolbar: info("CtToolbar"), bookmarks: info("CtBookmarks") };

// The menu itself, edited as a whole rather than filled from `parts`'
// defaults: its settings (where it's open and on which tab) have their own
// shape.
export const menu = info("CtMenu");

// The menu's tabs: ours first, then the user's by name.
export const tabs = Object.entries(all)
  .filter(([, m]) => m.tab)
  .map(([path, m]) => ({ name: name(path), component: m.default, tab: m.tab! }))
  .sort((a, b) => Number(!a.name.startsWith("Ct")) - Number(!b.name.startsWith("Ct")) || a.name.localeCompare(b.name));

// Every component the page places, and so hides: a part, the menu or a menu
// tab. `at` finds its settings in app.settings afresh each time (see App.focus).
export type Placeable = { name: string; label: string; info: WidgetInfo; ours: boolean; at: (s: Settings) => Record<string, any> };
export const placeables: Placeable[] = [
  { name: "CtMenu", label: menu.label, info: menu, ours: true, at: (s) => s.menu },
  { name: "CtClock", label: parts.clock.label, info: parts.clock, ours: true, at: (s) => s.clock },
  { name: "CtToolbar", label: parts.toolbar.label, info: parts.toolbar, ours: true, at: (s) => s.toolbar },
  { name: "CtBookmarks", label: parts.bookmarks.label, info: parts.bookmarks, ours: true, at: (s) => s.bookmarks },
  ...tabs.map((t) => ({ name: t.name, label: t.tab.label, info: t.tab as WidgetInfo, ours: t.name.startsWith("Ct"), at: (s: Settings) => s.menu.tabs[t.name] })),
];
