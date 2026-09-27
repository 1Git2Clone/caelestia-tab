// The new tab's core: loads settings, applies the scheme and wallpaper, and
// mounts one plugin per widget. Everything it shows lives in storage.local,
// and every change goes through it, so open tabs stay in step with each other
// and with the helper.
import plugins from "./plugins/index.js";
import { COLOURS, cssColour, cssVars } from "./scheme.js";
import * as ui from "./ui.js";
import { TREE_STYLE_TAB } from "./treestyletab.js";
import { SITES } from "./userstyles.js";

const store = browser.storage.local;
const $ = (id) => document.getElementById(id);
const { el, icon } = ui;

const DEFAULTS = {
  background: { source: "wallpaper", colour: "surfaceContainer", dim: 20, blur: 0 },
  // Each widget is an instance of a plugin, in page order.
  widgets: [
    { id: "clock", plugin: "clock", settings: {} },
    { id: "bookmarks", plugin: "bookmarks", settings: {} },
  ],
  sites: SITES,
  treeStyleTab: TREE_STYLE_TAB,
  css: "",
};

let settings = structuredClone(DEFAULTS);
let scheme = null;
let helperError = null;
let wallpaper = null;
let editing = false;
let unmounts = [];

const plugin = (w) => plugins.find((p) => p.id === w.plugin);
const widgetSettings = (w) => ({ ...structuredClone(plugin(w).defaults), ...w.settings });
const save = () => store.set({ settings });

function context(w) {
  return {
    settings: widgetSettings(w),
    editing,
    ui,
    save(next) {
      w.settings = next;
      return save();
    },
  };
}

function render() {
  for (const unmount of unmounts) unmount?.();
  unmounts = [];
  document.body.classList.toggle("editing", editing);
  $("custom").textContent = settings.css;
  applyBackground();

  const main = $("widgets");
  main.replaceChildren();
  const toolbar = $("toolbar");
  toolbar.replaceChildren();
  const button = (name, title, run, pressed) =>
    el("button", { type: "button", title, ariaLabel: title, ariaPressed: pressed ?? null, innerHTML: icon(name), onclick: run });

  for (const w of settings.widgets) {
    const p = plugin(w);
    if (!p || w.hidden) continue;
    const node = el("section", { className: `widget widget-${p.id}` });
    main.append(node);
    unmounts.push(p.mount(node, context(w)));
    for (const a of p.actions ?? []) toolbar.append(button(a.icon, a.title, () => a.run(context(w))));
  }
  toolbar.append(
    button("edit", editing ? "Done editing" : "Edit", () => ((editing = !editing), render()), String(editing)),
    button("settings", "Settings", openSettings),
  );

  if (!scheme && helperError) {
    main.append(el("p", { className: "notice", textContent: `No colours yet: ${helperError}. See Settings, Status.` }));
  }
}

function applyScheme() {
  $("scheme").textContent = scheme ? cssVars(scheme) : "";
  document.documentElement.dataset.mode = scheme?.mode ?? "dark";
}

let wallpaperUrl = null;

// A blob URL rather than the data URL itself, so the page's style doesn't
// carry a string the size of the image.
async function applyWallpaper() {
  if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
  wallpaperUrl = wallpaper ? URL.createObjectURL(await (await fetch(wallpaper.url)).blob()) : null;
  applyBackground();
}

function applyBackground() {
  const bg = settings.background;
  const node = $("background");
  node.style.backgroundImage = bg.source === "wallpaper" && wallpaperUrl ? `url("${wallpaperUrl}")` : "none";
  node.style.backgroundColor = bg.source === "colour" ? cssColour(bg.colour) : "var(--caelestia-background)";
  node.style.setProperty("--dim", bg.dim / 100);
  node.style.setProperty("--blur", `${bg.blur}px`);
}

function openSettings() {
  const redraw = () => dlg.show(current);
  let current = 0;
  const tabs = [
    { label: "Widgets", render: widgetsTab },
    { label: "Background", render: () => ui.form(BACKGROUND, settings.background, save) },
    { label: "Websites", render: websitesTab },
    { label: "Browser", render: browserTab },
    { label: "Advanced", render: advancedTab },
  ].map((t, i) => ({ ...t, render: () => ((current = i), t.render(redraw)) }));
  const dlg = ui.dialog({ title: "Settings", tabs });
}

const BACKGROUND = [
  {
    key: "source",
    label: "Background",
    type: "select",
    options: [
      ["wallpaper", "The caelestia wallpaper"],
      ["colour", "A scheme colour"],
      ["none", "The scheme's background colour"],
    ],
  },
  { key: "colour", label: "Colour, when it's a scheme colour", type: "colour" },
  { key: "dim", label: "Dim", type: "range", min: 0, max: 90, unit: "%" },
  { key: "blur", label: "Blur", type: "range", min: 0, max: 40, unit: "px" },
];

function widgetsTab(redraw) {
  const root = el("div", { className: "widgets-list" });
  settings.widgets.forEach((w, i) => {
    const p = plugin(w);
    if (!p) return;
    const move = (to) => {
      if (to < 0 || to >= settings.widgets.length) return;
      settings.widgets.splice(to, 0, ...settings.widgets.splice(i, 1));
      save();
      redraw();
    };
    const values = widgetSettings(w);
    root.append(
      el(
        "fieldset",
        {},
        el(
          "legend",
          {},
          el("span", { textContent: p.name }),
          el("button", { type: "button", title: "Move up", innerHTML: icon("up"), onclick: () => move(i - 1) }),
          el("button", { type: "button", title: "Move down", innerHTML: icon("down"), onclick: () => move(i + 1) }),
          el(
            "label",
            { className: "inline" },
            el("input", {
              type: "checkbox",
              checked: !w.hidden,
              onchange: (e) => {
                w.hidden = !e.target.checked;
                save();
              },
            }),
            " Show",
          ),
        ),
        ui.form(p.settings ?? [], values, () => {
          w.settings = values;
          save();
        }),
      ),
    );
  });
  return root;
}

function websitesTab() {
  const sites = (settings.sites = { ...SITES, ...settings.sites });
  const ALL = { origins: ["<all_urls>"] };
  const permission = el("p", { className: "row" });
  const showPermission = async () => {
    if (await browser.permissions.contains(ALL)) {
      permission.replaceChildren("Allowed on all sites.");
    } else {
      permission.replaceChildren(
        "Needs permission to run on all sites. ",
        // request() must run inside the click, before anything is awaited.
        el("button", { type: "button", className: "primary", textContent: "Allow", onclick: () => browser.permissions.request(ALL).then(showPermission) }),
      );
    }
  };
  showPermission();

  const list = el("div", { className: "styles" });
  const filter = el("input", { type: "search", placeholder: "Filter sites" });
  fetch("userstyles/index.json")
    .then((r) => r.json())
    .then(({ styles }) => {
      const rows = styles.map((s) => {
        const override = { domains: "", when: "", css: "", ...sites.overrides?.[s.id] };
        const saveOverride = () => {
          sites.overrides = { ...sites.overrides, [s.id]: override };
          save();
        };
        const fields = [
          { key: "domains", label: "Also on", type: "textarea", hint: "More domains for this style, one per line." },
          { key: "when", label: "Also on pages matching", type: "text", hint: "A CSS selector, checked once the page has loaded: the style applies wherever it matches." },
          { key: "css", label: "Your CSS", type: "textarea", hint: "Applied after the style, on the same pages. The scheme is in var(--caelestia-*)." },
        ];
        const body = ui.form(fields, override, saveOverride);
        return el(
          "details",
          { className: "site", title: s.name.toLowerCase() },
          el(
            "summary",
            {},
            el("input", {
              type: "checkbox",
              checked: !sites.off.includes(s.id),
              onclick: (e) => e.stopPropagation(),
              onchange: (e) => {
                sites.off = e.target.checked ? sites.off.filter((id) => id !== s.id) : [...sites.off, s.id];
                save();
              },
            }),
            ` ${s.name}`,
          ),
          body,
        );
      });
      filter.oninput = () => rows.forEach((r) => (r.hidden = !r.title.includes(filter.value.toLowerCase())));
    });

  return el(
    "div",
    {},
    el("p", {
      textContent:
        "Recolours sites with catppuccin/userstyles, compiled against the live scheme. Your own Stylus styles and userscripts get the same colours as var(--caelestia-primary) and friends, and a caelestia-scheme event on document when they change.",
    }),
    permission,
    ui.form(
      [
        { key: "enabled", label: "Theme websites", type: "checkbox" },
        {
          key: "accent",
          label: "Accent",
          type: "select",
          options: [...COLOURS.slice(0, 3), ["mauve", "Mauve"], ["pink", "Pink"], ["red", "Red"], ["peach", "Peach"], ["green", "Green"], ["blue", "Blue"], ["lavender", "Lavender"]],
        },
      ],
      sites,
      save,
    ),
    filter,
    list,
  );
}

function browserTab() {
  const tst = (settings.treeStyleTab = { ...TREE_STYLE_TAB, ...settings.treeStyleTab });
  return el(
    "div",
    {},
    el("h4", { textContent: "Tree Style Tab" }),
    el("p", { textContent: "Tints Tree Style Tab's sidebar towards the scheme's primary, and follows scheme switches live. Needs Tree Style Tab installed; nothing happens without it." }),
    ui.form(
      [
        { key: "tint", label: "Tint the sidebar", type: "checkbox" },
        { key: "strength", label: "Strength", type: "range", min: 0, max: 40, unit: "%" },
      ],
      tst,
      save,
    ),
  );
}

function advancedTab(redraw) {
  const status = scheme
    ? `Connected. Scheme ${scheme.name} ${scheme.flavour}, ${scheme.mode}.`
    : `Not connected${helperError ? `: ${helperError}` : ""}. Install the helper and run caelestia-tab install, then restart the browser.`;
  const json = el("textarea", { rows: 10, spellcheck: false, value: JSON.stringify(settings, null, 2) });
  return el(
    "div",
    {},
    el("h4", { textContent: "Status" }),
    el("p", { textContent: status }),
    ui.form([{ key: "css", label: "Custom CSS", type: "textarea", hint: "Applied to this page after its own styles. The scheme is in var(--caelestia-*)." }], settings, save),
    el("h4", { textContent: "All settings" }),
    json,
    el(
      "div",
      { className: "row" },
      el("button", {
        type: "button",
        textContent: "Apply",
        onclick: () => {
          try {
            settings = { ...structuredClone(DEFAULTS), ...JSON.parse(json.value) };
          } catch (e) {
            alert(`Not valid JSON: ${e.message}`);
            return;
          }
          save();
          redraw();
        },
      }),
      el("button", {
        type: "button",
        textContent: "Reset everything",
        onclick: () => {
          if (!confirm("Reset every setting and bookmark to the defaults?")) return;
          settings = structuredClone(DEFAULTS);
          save();
          redraw();
        },
      }),
    ),
  );
}

const got = await store.get(["settings", "scheme", "wallpaper", "helperError"]);
settings = { ...settings, ...got.settings };
({ scheme = null, wallpaper = null, helperError = null } = got);
applyScheme();
render();
applyWallpaper();

store.onChanged.addListener((changes) => {
  if (changes.scheme) {
    scheme = changes.scheme.newValue ?? null;
    applyScheme();
  }
  if (changes.wallpaper) {
    wallpaper = changes.wallpaper.newValue ?? null;
    applyWallpaper();
  }
  if (changes.helperError) helperError = changes.helperError.newValue ?? null;
  if (changes.settings) {
    // Our own writes come back here too. Keep the object open dialogs are
    // editing unless another tab changed it.
    const next = changes.settings.newValue ?? structuredClone(DEFAULTS);
    if (JSON.stringify(next) !== JSON.stringify(settings)) settings = { ...structuredClone(DEFAULTS), ...next };
  }
  if (changes.settings || changes.helperError || (changes.scheme && !changes.scheme.oldValue)) render();
});

// Keeps the background, and with it the helper, running while this tab is open.
browser.runtime.connect({ name: "newtab" });
