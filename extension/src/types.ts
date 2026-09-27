// What the helper sends as `scheme`: caelestia's scheme.json as it wrote it.
export interface Scheme {
  name: string;
  flavour: string;
  mode: "dark" | "light";
  variant: string;
  // Colour name to hex, without the `#`.
  colours: Record<string, string>;
}

// The browser's WebExtension API.
// ponytail: untyped; @types/firefox-webext-browser when a call site needs checking.
declare global {
  const browser: any;
}
