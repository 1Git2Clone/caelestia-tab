# Site themes

The extension ships the 134 styles of
[catppuccin/userstyles](https://github.com/catppuccin/userstyles) (MIT, its
licence in `extension/userstyles/LICENSE`) unchanged, and compiles them against
the live caelestia scheme instead of a Catppuccin flavour.

## Why compile, not rewrite to CSS variables

The styles are LESS, and they do a lot with concrete colours at compile time:
`fade()`, `darken()`, `mix()`, `red()`, `hue()`, colours escaped into inline
SVG data URLs, and CSS filter chains per colour. A `var()` can't be faded at
compile time or put inside a data URL, so a one-off conversion to variables
would break most of them. Compiling each style with the scheme's real colours
keeps every one of them working. All 134 compile, in about 27 ms each
(measured 2026-09-27).

## How a page gets themed

1. `content.js` runs at `document_start` in every frame and asks the
   background for its theme, handing over the CSS it applied last time (none,
   at first).
2. The background builds the CSS: the scheme's `--caelestia-*` variables, plus
   every enabled style whose URL rules match the page.
3. A style is compiled the first time a matching page asks, then cached until
   the scheme or the accent changes.
4. The background removes the old CSS from that frame and inserts the new
   with `scripting.insertCSS`, and the content script keeps what it got.
5. When `scheme` or `settings` change in storage, every content script asks
   again. That's the live switch.

The content script, not the background, remembers what was injected into its
frame. The background can be suspended between two switches, and a restarted
background has no record of what it inserted; `removeCSS` needs the exact CSS
that was inserted.

`insertCSS` rather than a `<style>` element, because a page's
Content-Security-Policy can block inline styles but not an extension's
inserted sheet.

## Overrides

The styles are applied as upstream wrote them; anything beyond that is the
user's, in `settings.sites.overrides[id]` (see
[Theming your own sites](../guides/own-styles.md#overriding-a-bundled-site-style)):
`domains`, `when` (a CSS selector) and `css`. The extension ships no fixes of
its own; recipes live in the docs.

- `domains` are extra `domain` rules. A style matched through one, or through
  `when`, contributes all its `@-moz-document` bodies (`cssFor(…, all)`),
  because its own rules don't name that page.
- `when` needs the parsed document, which `document_start` doesn't have. The
  content script asks once at `document_start` as always, then again at
  `DOMContentLoaded`, sending the ids whose selector matches as `detected`.
  So a page themed only through `when` shows the unthemed page until its DOM is
  parsed.
- `css` goes after the style's CSS, so it wins at equal specificity.

## The palette swap

`userstyles.js` `libFor()` rewrites the vendored `lib.less` before compiling:

- The `@catppuccin` map gets the scheme's colours under both `@latte` and
  `@mocha`. caelestia's scheme carries all 26 Catppuccin colour names.
- `@accent` becomes a scheme colour, `primary` by default (*Settings*,
  *Websites*, *Accent*).
- `lightFlavor` and `darkFlavor` are both set to `latte` when the scheme is
  light and `mocha` when it's dark. The flavour then only decides the styles'
  `if(@flavor = latte, …)` branches, which pick between colours made for a
  light or a dark palette.

## @-moz-document

Stylus understands `@-moz-document`; web pages don't. So after compiling, the
extension splits the CSS into its `@-moz-document` blocks and injects only the
bodies of the blocks whose rules match the page, with Stylus's semantics
(`domain` matches subdomains, `regexp` must match the whole URL). Some styles
build their rules with LESS (syncthing's come from an `@var`), so the vendoring
script reads them from a compiled copy into `index.json`; that tells the
background which styles a page wants before it compiles any.

## Checking the styles

`tests/sites-firefox.mjs` loads a page for every style in a headless Firefox
with the extension, logged out, and reports whether the background behind the
middle of the page became a scheme colour. It's slow and depends on the live
sites, so it's run by hand (see [Development](../guides/development.md)). A
failure is a lead, not a verdict: a landing page that differs from the
logged-in site, a page whose middle is an image, or a style that only covers
some pages all show up as failures.

## Known gaps

- The `@<colour>-filter` values are Catppuccin's own precomputed filter chains,
  so the icons a few styles tint with a CSS filter come out in Catppuccin's
  shade rather than the scheme's. Fixing it needs a solver that finds a filter
  chain for an arbitrary colour.
- A style's own options (`@var` checkboxes like YouTube's logo) are fixed at
  their defaults. There's no UI for them yet.
