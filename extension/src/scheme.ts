// The scheme as CSS custom properties: `surfaceContainerHigh` becomes
// `--caelestia-surface-container-high`. These are the variables the new tab,
// the site themes and anyone's own Stylus styles or userscripts read.
import type { Scheme } from "./types.ts";

export function cssVars(scheme: Scheme) {
  const vars = Object.entries(scheme.colours)
    // caelestia also writes snake_case duplicates of a few keys.
    .filter(([name]) => !name.includes("_"))
    .map(([name, hex]) => `--caelestia-${kebab(name)}: #${hex};`);
  return `:root { ${vars.join(" ")} --caelestia-mode: ${scheme.mode}; }`;
}

export const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// The scheme colours offered wherever a tile or background picks one.
export const COLOURS: [string, string][] = [
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["tertiary", "Tertiary"],
  ["primaryContainer", "Primary container"],
  ["secondaryContainer", "Secondary container"],
  ["tertiaryContainer", "Tertiary container"],
  ["surfaceContainer", "Surface"],
  ["surfaceContainerHighest", "Surface, raised"],
  ["error", "Error"],
];

// A colour setting is a scheme token (follows the scheme) or a fixed #rrggbb.
export const cssColour = (token: string) => (token.startsWith("#") ? token : `var(--caelestia-${kebab(token)})`);

// The text colour that goes on a colour: primary takes onPrimary, and every
// surface takes onSurface.
// A fixed colour takes black or white, whichever reads better on it.
export function onColour(token: string) {
  if (token.startsWith("#")) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(token.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#000000" : "#ffffff";
  }
  return token.startsWith("surface") ? "onSurface" : `on${token[0].toUpperCase()}${token.slice(1)}`;
}

// The accent that goes with a colour, for the line under a bookmark: a solid
// colour takes the one after it round primary, secondary, tertiary; a
// container takes its own solid colour; a surface, primary. A fixed colour
// takes primary.
const COMPLEMENT: Record<string, string> = {
  primary: "tertiary",
  secondary: "primary",
  tertiary: "secondary",
  primaryContainer: "primary",
  secondaryContainer: "secondary",
  tertiaryContainer: "tertiary",
  error: "errorContainer",
};
export const complement = (token: string) => COMPLEMENT[token] ?? "primary";
