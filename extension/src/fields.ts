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
import type { App } from "./store.svelte.ts";

export type Field =
  | { key: string; label: string; hint?: string; type: "checkbox" | "text" | "url" | "textarea"; placeholder?: string; rows?: number }
  | { key: string; label: string; hint?: string; type: "number"; min?: number; max?: number; step?: number }
  | { key: string; label: string; hint?: string; type: "range"; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; hint?: string; type: "select"; options: [string, string][] }
  // A scheme colour token (primary, surfaceContainer …) or a #rrggbb.
  | { key: string; label: string; hint?: string; type: "colour" }
  // A URL or an uploaded file, as a data: URL.
  | { key: string; label: string; hint?: string; type: "image" }
  // A Nerd Font glyph; `words` are what to suggest glyphs for.
  | { key: string; label: string; hint?: string; type: "glyph"; words?: (values: any) => string[] }
  // Buttons that set several keys at once.
  | { type: "presets"; label: string; hint?: string; presets: { label: string; values: Record<string, any> }[] };

export interface WidgetInfo {
  label: string;
  defaults: Record<string, any>;
  fields: Field[];
  // Classes for the widget's wrapper, the item in the page's column: where
  // it sits (self-center, my-auto …) rather than how it looks.
  section?: string;
  // Toolbar buttons while the widget is shown.
  actions?: { icon: string; title: string; run: (settings: any, app: App) => void }[];
}
