// The settings API. Each part of the page (the clock, the toolbar, the
// bookmarks) and each menu tab exports the fields its props take; the pen
// opens a form drawn from them in the side panel, and whatever the user sets
// arrives as the component's `settings` prop. A user's own menu tab uses the
// same API:
//
//   <script module lang="ts">
//     import type { TabInfo } from "$ct/fields.ts";
//     export const tab: TabInfo = {
//       label: "Weather",
//       glyph: "\u{f0599}", // nf-md-weather_partly_cloudy
//       defaults: { city: "Sofia", unit: "c" },
//       fields: [
//         { key: "city", label: "City", type: "text" },
//         { key: "unit", label: "Unit", type: "select", options: [["c", "Celsius"], ["f", "Fahrenheit"]] },
//       ],
//     };
//   </script>
import type { App } from "./store.svelte.ts";

// Every field can take `when`: shown only while it returns true for the
// values, like a colour that only matters when the source is a colour.
type When = { when?: (values: any) => boolean };

export type Field = When &
  (
  | { key: string; label: string; hint?: string; type: "checkbox" | "text" | "url" | "textarea"; placeholder?: string; rows?: number }
  | { key: string; label: string; hint?: string; type: "number"; min?: number; max?: number; step?: number }
  | { key: string; label: string; hint?: string; type: "range"; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; hint?: string; type: "select"; options: [string, string][] }
  // One of two values, side by side.
  | { key: string; label: string; hint?: string; type: "switch"; options: [[string, string], [string, string]] }
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

// A part of the page or a menu tab: its name, its settings' defaults and
// the fields that edit them. Every part and tab gets a Hide checkbox, last
// in its form, so a component implements nothing to be hideable; a
// component that exports neither `widget` nor `tab` is a building block for
// others, with no pen, no Hide and no row in Settings › Components.
export interface WidgetInfo {
  label: string;
  defaults: Record<string, any>;
  fields: Field[];
  // Toolbar buttons, for the bookmarks' +.
  actions?: { icon: string; title: string; run: (settings: any, app: App) => void }[];
  // Under the Hide checkbox every part and tab gets, when hiding it needs a
  // word of warning.
  hideHint?: string;
}

// A menu tab: a component that exports `tab`. Its glyph (a Nerd Font one)
// and label are its button on the menu's bar.
export interface TabInfo extends WidgetInfo {
  glyph: string;
}
