// Bookmark tiles on a CSS grid the user defines in full: the grid's columns,
// row height, gap and flow come from settings, and each tile's placement is a
// span or any grid-column / grid-row value.
import { words } from "../glyphs.js";
import { cssColour, onColour } from "../scheme.js";

const PRESETS = [
  { label: "Tiles", values: { columns: "repeat(5, minmax(0, 1fr))", rows: "140px", gap: "20px" } },
  { label: "List", values: { columns: "repeat(3, minmax(0, 1fr))", rows: "52px", gap: "12px" } },
];

const item = (props) => ({
  id: crypto.randomUUID(),
  name: "",
  url: "",
  letter: "",
  glyph: "",
  showLetter: true,
  showName: true,
  image: "",
  colour: "primary",
  width: 1,
  height: 1,
  column: "",
  row: "",
  ...props,
});

const initials = (name) => name.trim().slice(0, 2);

const place = (node, it) => {
  node.style.gridColumn = it.column || `span ${it.width}`;
  node.style.gridRow = it.row || `span ${it.height}`;
};

function tile(it, { link = true } = {}) {
  const node = document.createElement(link ? "a" : "div");
  node.className = "tile";
  if (link) node.href = it.url;
  node.style.setProperty("--tile", cssColour(it.colour));
  node.style.setProperty("--on-tile", cssColour(onColour(it.colour)));
  if (it.image) {
    node.classList.add("has-image");
    node.style.backgroundImage = `url(${JSON.stringify(it.image)})`;
  }
  if (it.showLetter) {
    // A glyph takes the letters' place.
    const className = it.glyph ? "letter glyph" : "letter";
    node.append(Object.assign(document.createElement("span"), { className, textContent: it.glyph || it.letter || initials(it.name) }));
  }
  if (it.showName) node.append(Object.assign(document.createElement("span"), { className: "name", textContent: it.name }));
  return node;
}

function save(ctx, items) {
  return ctx.save({ ...ctx.settings, items });
}

function move(ctx, from, to) {
  const items = [...ctx.settings.items];
  if (to < 0 || to >= items.length) return;
  items.splice(to, 0, ...items.splice(from, 1));
  return save(ctx, items);
}

// The edit dialog, for an existing tile (index) or a new one (-1).
function edit(ctx, index) {
  const { dialog, form, el } = ctx.ui;
  const draft = structuredClone(index < 0 ? item({ name: "New bookmark" }) : ctx.settings.items[index]);
  const preview = el("div", { className: "preview" });
  const redraw = () => preview.replaceChildren(el("small", { textContent: "Preview" }), tile(draft, { link: false }));
  const update = () => redraw();
  redraw();

  const tab = (label, fields) => ({ label, render: () => form(fields, draft, update) });
  dialog({
    title: index < 0 ? "Add a bookmark" : `Edit ${draft.name}`,
    aside: preview,
    tabs: [
      tab("Visual & Name", [
        { key: "name", label: "Name", type: "text" },
        { key: "showName", label: "Show the name", type: "checkbox" },
        { key: "letter", label: "Letters", type: "text", hint: "A short label or an emoji. Empty uses the name's first two letters." },
        {
          key: "glyph",
          label: "Glyph",
          type: "glyph",
          words: () => words(draft.url, draft.name),
          hint: "A Nerd Font glyph, shown instead of the letters. Suggestions follow the address and the name.",
        },
        { key: "showLetter", label: "Show the letters or glyph", type: "checkbox" },
        { key: "image", label: "Image", type: "image", hint: "Covers the tile. Without one, the tile is a solid scheme colour." },
      ]),
      tab("Address", [{ key: "url", label: "URL", type: "url", placeholder: "https://example.com" }]),
      tab("Layout", [
        { key: "width", label: "Width, in columns", type: "number", min: 1, max: 24 },
        { key: "height", label: "Height, in rows", type: "number", min: 1, max: 24 },
        { key: "column", label: "grid-column", type: "text", placeholder: "span 2, 1 / 3, 2 / -1 …", hint: "Any grid-column value. Overrides the width." },
        { key: "row", label: "grid-row", type: "text", placeholder: "span 2, 1 / 3 …", hint: "Any grid-row value. Overrides the height." },
      ]),
      tab("Theme", [{ key: "colour", label: "Colour", type: "colour", hint: "Fills the tile when it has no image. Follows the scheme." }]),
    ],
    onSave: () => {
      draft.url = draft.url.trim();
      if (!draft.url) {
        alert("A bookmark needs a URL.");
        return false;
      }
      if (!/^[a-z][\w+.-]*:/i.test(draft.url)) draft.url = `https://${draft.url}`;
      const items = [...ctx.settings.items];
      if (index < 0) items.push(draft);
      else items[index] = draft;
      return save(ctx, items);
    },
  });
}

function slot(ctx, it, index) {
  const { icon } = ctx.ui;
  const node = document.createElement("div");
  node.className = "slot";
  node.draggable = true;
  place(node, it);
  const controls = document.createElement("div");
  controls.className = "controls";
  const button = (name, title, run) =>
    Object.assign(document.createElement("button"), { type: "button", title, innerHTML: icon(name), onclick: run });
  controls.append(
    button("left", "Move earlier", () => move(ctx, index, index - 1)),
    Object.assign(document.createElement("span"), { className: "grip", title: "Drag to move", innerHTML: icon("drag") }),
    button("right", "Move later", () => move(ctx, index, index + 1)),
    button("edit", "Edit", () => edit(ctx, index)),
    button("close", "Remove", () => {
      if (confirm(`Remove ${it.name || "this bookmark"}?`)) save(ctx, ctx.settings.items.toSpliced(index, 1));
    }),
  );
  node.append(tile(it, { link: false }), controls);

  node.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/x-caelestia-bookmark", String(index));
    e.dataTransfer.effectAllowed = "move";
    node.classList.add("dragging");
  });
  node.addEventListener("dragend", () => node.classList.remove("dragging"));
  node.addEventListener("dragover", (e) => {
    if (!e.dataTransfer.types.includes("text/x-caelestia-bookmark")) return;
    e.preventDefault();
    node.classList.add("drop");
  });
  node.addEventListener("dragleave", () => node.classList.remove("drop"));
  node.addEventListener("drop", (e) => {
    e.preventDefault();
    move(ctx, Number(e.dataTransfer.getData("text/x-caelestia-bookmark")), index);
  });
  return node;
}

export default {
  id: "bookmarks",
  name: "Bookmarks",
  defaults: {
    ...PRESETS[0].values,
    flow: "row dense",
    items: [
      // nf-fa-github, nf-fa-youtube, nf-fa-wikipedia_w, nf-dev-mozilla
      item({ name: "GitHub", url: "https://github.com", colour: "primary", glyph: "" }),
      item({ name: "YouTube", url: "https://www.youtube.com", colour: "tertiary", width: 2, glyph: "" }),
      item({ name: "Wikipedia", url: "https://www.wikipedia.org", colour: "secondary", glyph: "" }),
      item({ name: "MDN", url: "https://developer.mozilla.org", colour: "primaryContainer", glyph: "" }),
    ],
  },
  settings: [
    { type: "presets", label: "Start from", presets: PRESETS },
    { key: "columns", label: "Columns", type: "text", hint: "grid-template-columns: repeat(5, minmax(0, 1fr)), 200px 1fr 2fr, repeat(auto-fill, minmax(160px, 1fr)) …" },
    { key: "rows", label: "Row height", type: "text", hint: "grid-auto-rows: 140px, minmax(52px, auto) …" },
    { key: "gap", label: "Gap", type: "text", hint: "gap: 20px, or 12px 24px for rows and columns." },
    {
      key: "flow",
      label: "Flow",
      type: "select",
      options: [
        ["row", "Rows"],
        ["row dense", "Rows, filling gaps"],
        ["column", "Columns"],
        ["column dense", "Columns, filling gaps"],
      ],
    },
  ],
  actions: [{ icon: "add", title: "Add a bookmark", run: (ctx) => edit(ctx, -1) }],

  mount(el, ctx) {
    const s = ctx.settings;
    const grid = document.createElement("div");
    grid.className = "bookmarks";
    // Invalid values are dropped by the browser, so a half-typed setting
    // leaves the grid as it was.
    grid.style.gridTemplateColumns = s.columns;
    grid.style.gridAutoRows = s.rows;
    grid.style.gap = s.gap;
    grid.style.gridAutoFlow = s.flow;
    for (const [i, it] of s.items.entries()) {
      if (ctx.editing) {
        grid.append(slot(ctx, it, i));
      } else {
        const node = tile(it);
        place(node, it);
        grid.append(node);
      }
    }
    if (!s.items.length) grid.innerHTML = `<p class="empty">No bookmarks yet. Add one with the + button.</p>`;
    el.append(grid);
  },
};
