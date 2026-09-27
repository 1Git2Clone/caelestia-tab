// Every widget component: ours from components/widgets/, named Ct*. A widget
// is any component that also exports `widget` (see fields.ts).
import type { Component } from "svelte";
import type { WidgetInfo } from "./fields.ts";

type Module = { default: Component<any>; widget?: WidgetInfo };

const ours = import.meta.glob<Module>("./components/widgets/*.svelte", { eager: true });

export const widgets = Object.entries(ours)
  .filter(([, m]) => m.widget)
  .map(([path, m]) => ({ name: path.split("/").at(-1)!.replace(/\.svelte$/, ""), component: m.default, widget: m.widget! }));
