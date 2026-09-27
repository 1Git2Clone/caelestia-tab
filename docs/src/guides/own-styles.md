# Theming your own sites

Every page gets the live scheme as CSS custom properties on `:root`, so your
own Stylus styles and userscripts can follow caelestia as well as the bundled
themes do.

The names are caelestia's colour names in kebab case: `surfaceContainerHigh`
becomes `--caelestia-surface-container-high`. The Material colours are all
there (`primary`, `on-primary`, `primary-container`, `surface`, `outline` and
so on), and so are the Catppuccin names (`base`, `mantle`, `text`, `mauve` …),
the terminal colours (`term0` to `term15`) and `--caelestia-mode`, which is
`dark` or `light`.

## A Stylus style

```css
@-moz-document domain("example.com") {
  body {
    background: var(--caelestia-surface);
    color: var(--caelestia-on-surface);
  }
  a {
    color: var(--caelestia-primary);
  }
  /* Blends work too, and follow the scheme live. */
  .card {
    background: color-mix(in srgb, var(--caelestia-primary) 12%, var(--caelestia-surface));
  }
}
```

Switch the caelestia scheme and the page changes without a reload.

## A userscript

The variables are on `document.documentElement`. When the scheme changes, a
`caelestia-scheme` event fires on `document`:

```js
function apply() {
  const primary = getComputedStyle(document.documentElement).getPropertyValue("--caelestia-primary").trim();
  // use it
}
apply();
document.addEventListener("caelestia-scheme", apply);
```

## Limits

- Pages the browser won't let extensions touch (`about:` pages, the add-ons
  site) get nothing.
- The variables need the site-theme permission (*Settings*, *Websites*,
  *Allow*). Turning *Theme websites* off keeps the variables and drops only
  the bundled themes.
