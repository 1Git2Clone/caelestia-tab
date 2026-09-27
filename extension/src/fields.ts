// The settings API. A widget component exports the fields its props take, and
// the settings panel draws a form from them; whatever the user sets arrives
// as the component's `settings` prop. User components use the same API.
//
//   <script module lang="ts">
//     import type { WidgetInfo } from "$ct/fields.ts";
//     export const widget: WidgetInfo = {
//       label: "Weather",
//       defaults: { city: "Sofia", unit: "c" },
//       fields: [
//         { key: "city", label: "City", type: "text" },
//         { key: "unit", label: "Unit", type: "select", options: [["c", "Celsius"], ["f", "Fahrenheit"]] },
//       ],
//     };
//   </script>
import type { Component } from "svelte";
import type { App, Place } from "./store.svelte.ts";

// Every field can take `when`: shown only while it returns true for the
// values, like a colour that only matters when the source is a colour.
type When = { when?: (values: any) => boolean };

export type Field = When &
  (
  | { key: string; label: string; hint?: string; type: "checkbox" | "text" | "url" | "textarea"; placeholder?: string; rows?: number }
  | { key: string; label: string; hint?: string; type: "number"; min?: number; max?: number; step?: number }
  | { key: string; label: string; hint?: string; type: "range"; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; hint?: string; type: "select"; options: [string, string][] }
  // A scheme colour token (primary, surfaceContainer …) or a #rrggbb.
  | { key: string; label: string; hint?: string; type: "colour" }
  // A URL or an uploaded file, as a data: URL.
  | { key: string; label: string; hint?: string; type: "image" }
  // A CSS font-family, with the installed fonts (from the helper) offered.
  | { key: string; label: string; hint?: string; type: "font" }
  // A Nerd Font glyph; `words` are what to suggest glyphs for.
  | { key: string; label: string; hint?: string; type: "glyph"; words?: (values: any) => string[] }
  // Buttons that set several keys at once.
  | { type: "presets"; label: string; hint?: string; presets: { label: string; values: Record<string, any> }[] }
  );

export interface WidgetInfo {
  label: string;
  defaults: Record<string, any>;
  fields: Field[];
  // Where a new widget of this kind sits on the page's grid.
  place?: Partial<Place>;
  // Edit mode's overlay on this widget: a component of your own, which gets
  // { widget, app }, or false for none. Without it, CtEditOverlay: a chip
  // that opens the widget's settings and placement.
  overlay?: Component<any> | false;
  // Toolbar buttons while the widget is shown.
  actions?: { icon: string; title: string; run: (settings: any, app: App) => void }[];
}

const SELF: [string, string][] = [
  ["start", "Start"],
  ["center", "Centre"],
  ["end", "End"],
  ["stretch", "Stretch"],
];

// Every widget's placement on the page's grid (Widget.place).
export const PLACE: Field[] = [
  { key: "area", label: "Area", type: "text", placeholder: "clock, or 2 / 1 / 3 / -1", hint: "An area's name from the page layout, or any grid-area value." },
  { key: "justify", label: "Horizontally", type: "select", options: SELF },
  { key: "align", label: "Vertically", type: "select", options: SELF },
];

// The page's grid (Settings.layout), typed as CSS.
export const LAYOUT: Field[] = [
  { key: "columns", label: "Columns", type: "text", hint: "grid-template-columns: minmax(0, 1fr), 20rem 1fr …" },
  { key: "rows", label: "Rows", type: "text", hint: "grid-template-rows: auto minmax(0, 1fr) auto … minmax(0, 1fr) rather than 1fr lets a tall widget scroll instead of pushing the page longer." },
  { key: "areas", label: "Areas", type: "textarea", rows: 3, hint: 'grid-template-areas, one quoted row per line: "toolbar toolbar" "clock bookmarks". Widgets name them in their placement.' },
  { key: "gap", label: "Gap", type: "text", hint: "gap: 2rem, or 1rem 2rem." },
  { key: "padding", label: "Padding", type: "text", hint: "Around the page: 1rem 2.5rem 0." },
];
