// Every component, ours (components/, named Ct*) and, in a user build, the
// user's. A widget is a component that also exports `widget` (see fields.ts);
// any component can be named where settings take a component (the panel).
import type { Component } from "svelte";
import type { WidgetInfo } from "./fields.ts";

type Module = { default: Component<any>; widget?: WidgetInfo };

// Not App: it imports this module, and the root is never named in settings.
const ours = import.meta.glob<Module>(["./components/*.svelte", "./components/widgets/*.svelte", "!./components/App.svelte"], { eager: true });
// The user's, from $user (vite.config.ts): empty when they have none.
const theirs = import.meta.glob<Module>("$user/**/*.svelte", { eager: true });
const all = { ...ours, ...theirs };

const name = (path: string) => path.split("/").at(-1)!.replace(/\.svelte$/, "");

export const components = Object.fromEntries(Object.entries(all).map(([path, m]) => [name(path), m.default]));

export const widgets = Object.entries(all)
  .filter(([, m]) => m.widget)
  .map(([path, m]) => ({ name: name(path), component: m.default, widget: m.widget! }));
