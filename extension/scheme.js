// The scheme as CSS custom properties: `surfaceContainerHigh` becomes
// `--caelestia-surface-container-high`. These are the variables the new tab,
// the site themes and anyone's own Stylus styles or userscripts read.
export function cssVars(scheme) {
  const vars = Object.entries(scheme.colours)
    // caelestia also writes snake_case duplicates of a few keys.
    .filter(([name]) => !name.includes("_"))
    .map(([name, hex]) => `--caelestia-${kebab(name)}: #${hex};`);
  return `:root { ${vars.join(" ")} --caelestia-mode: ${scheme.mode}; }`;
}

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// The scheme colours offered wherever a tile or background picks one.
export const COLOURS = [
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

export const cssColour = (token) => `var(--caelestia-${kebab(token)})`;

// The text colour that goes on a colour: primary takes onPrimary, and every
// surface takes onSurface.
export const onColour = (token) =>
  token.startsWith("surface") ? "onSurface" : `on${token[0].toUpperCase()}${token.slice(1)}`;
