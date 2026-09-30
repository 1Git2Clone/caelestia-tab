# Theming your own sites

Every page gets the live scheme as CSS custom properties on `:root`, so your
own Stylus styles and userscripts can follow caelestia as well as the bundled
themes do.

## Settings › Websites

The fourth tab lists every site in two sections: *User-defined* (yours, see
below) on top, then *catppuccin/userstyles* (the bundled ones) under it. The
filter box above both narrows either section to sites whose name matches; a
section with nothing left after filtering shows just its heading, except an
empty *User-defined* section, which hints that typing a name in the filter
adds one. Each section's heading has its own checkbox that switches every
site in that section on or off at once (ticked when all of them are on,
dashed when some are), whether or not the filter is hiding any of them.
Each site's star keeps it at the top of its section: starred sites come
first, alphabetically, then the rest, alphabetically.

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

## A site of your own

For a site no bundled style covers: *Settings*, *Websites*, type its name in
the filter, and press Enter (or pick *Add "…", a site of your own* under the
list). It opens with three fields: the domains it's on, one per line; *Also on
pages matching*, a CSS selector for pages it's on wherever they're hosted;
and your CSS, which gets the scheme as `var(--caelestia-*)` like any page. It
can be turned off with its checkbox, like the bundled ones, and removed from
its own section.

## Overriding a bundled site style

The bundled styles are Catppuccin's, applied as upstream wrote them. To go
further, open *Settings*, *Websites* and click a site's name. Each has three
fields, all empty by default:

- **Also on**: more domains for the style, one per line. `docs.example.org`
  covers its subdomains too.
- **Also on pages matching**: a CSS selector. Once a page has loaded, the
  style applies to it if the selector matches anything, wherever the page is
  hosted. This is for kinds of site, like documentation generators, that live
  on many domains.
- **Your CSS**: applied after the style, on every page the style applies to.
  It can use the `--caelestia-*` variables, and wins over the style, since it
  comes later.

The page picks up a change on its next scheme switch or reload. Extra
domains and selectors take the style's rules for all its pages at once: the
path filters some styles have (GitHub's leaves out `github.com/home`, for
example) don't apply to them.

### Recipes

**mdBook, on any domain.** Catppuccin's mdBook style lists only a few
well-known books. Every mdBook page has a theme picker, so under *mdBook*,
set *Also on pages matching* to:

```css
#mdbook-theme-list, #theme-list
```

(`#mdbook-theme-list` in mdBook 0.5, `#theme-list` before it.)

**claude.ai's current design.** Claude moved to a new set of `--cds-*`
variables, and Catppuccin's Claude style still sets the old ones, so it
changes nothing. Paste this into *Claude*'s *Your CSS*:

```css
{{#include recipes/claude.css}}
```

## Limits

- Pages the browser won't let extensions touch (`about:` pages, the add-ons
  site) get nothing.
- The variables need the site-theme permission (*Settings*, *Websites*,
  *Allow*). Turning *Theme websites* off keeps the variables and drops only
  the bundled themes.
