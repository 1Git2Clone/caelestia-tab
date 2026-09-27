// The pieces plugins build their settings from, handed to them as ctx.ui so a
// plugin never imports the core.
import { COLOURS, cssColour } from "./scheme.js";
import { icon } from "./icons.js";

export { icon };

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

// A modal with tabs along the top. `onSave` gives it Cancel and Save, and it
// stays open when onSave returns false; without one there's just Close, for
// dialogs whose fields apply as they change.
export function dialog({ title, tabs, aside, onSave }) {
  const d = document.getElementById("dialog");
  const panel = el("div", { className: "panel" });
  const tablist = el("div", { className: "tabs", role: "tablist" });
  const show = (i) => {
    tablist.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", i === j));
    panel.replaceChildren(el("h3", { textContent: tabs[i].label }), tabs[i].render());
  };
  tabs.forEach((t, i) => tablist.append(el("button", { type: "button", role: "tab", textContent: t.label, onclick: () => show(i) })));

  const footer = el("footer");
  if (onSave) {
    footer.append(
      el("button", { type: "button", textContent: "Cancel", onclick: () => d.close() }),
      el("button", {
        type: "button",
        className: "primary",
        textContent: "Save",
        onclick: async () => (await onSave()) !== false && d.close(),
      }),
    );
  } else {
    footer.append(el("button", { type: "button", className: "primary", textContent: "Close", onclick: () => d.close() }));
  }

  d.replaceChildren(el("h2", { textContent: title }), tablist, el("div", { className: "dialog-body" }, panel, aside), footer);
  show(0);
  if (!d.open) d.showModal();
  return { show };
}

// Renders `fields` against `values` and calls `update(patch)` as they change.
//
//   { key, label, type, hint }  with type one of checkbox, text, url, number,
//   textarea, select (options: [[value, label]]), range (min, max, step,
//   unit), colour (a scheme colour swatch), image (a URL or an uploaded file);
//   { type: "presets", label, presets: [{ label, values }] } sets several keys.
export function form(fields, values, update) {
  const root = el("div", { className: "form" });
  const set = (patch) => {
    Object.assign(values, patch);
    update(patch);
  };
  for (const f of fields) root.append(field(f, values, set, () => root.replaceWith(form(fields, values, update))));
  return root;
}

function field(f, values, set, redraw) {
  const value = values[f.key];
  const hint = f.hint && el("small", { textContent: f.hint });
  switch (f.type) {
    case "checkbox":
      return el(
        "label",
        { className: "field inline" },
        el("input", { type: "checkbox", checked: !!value, onchange: (e) => set({ [f.key]: e.target.checked }) }),
        el("span", { textContent: f.label }),
        hint,
      );
    case "select":
      return el(
        "label",
        { className: "field" },
        el("span", { textContent: f.label }),
        el(
          "select",
          { onchange: (e) => set({ [f.key]: e.target.value }) },
          ...f.options.map(([v, label]) => el("option", { value: v, textContent: label, selected: v === value })),
        ),
        hint,
      );
    case "range": {
      const out = el("output", { textContent: `${value}${f.unit ?? ""}` });
      return el(
        "label",
        { className: "field" },
        el("span", { textContent: f.label }, " ", out),
        el("input", {
          type: "range",
          min: f.min,
          max: f.max,
          step: f.step ?? 1,
          value,
          oninput: (e) => {
            out.textContent = `${e.target.value}${f.unit ?? ""}`;
            set({ [f.key]: Number(e.target.value) });
          },
        }),
        hint,
      );
    }
    case "colour":
      return el(
        "div",
        { className: "field" },
        el("span", { textContent: f.label }),
        el(
          "div",
          { className: "swatches", role: "radiogroup" },
          ...COLOURS.map(([token, label]) =>
            el("button", {
              type: "button",
              role: "radio",
              title: label,
              ariaChecked: token === value,
              ariaLabel: label,
              style: `--swatch: ${cssColour(token)}`,
              onclick: () => {
                set({ [f.key]: token });
                redraw();
              },
            }),
          ),
        ),
        hint,
      );
    case "image": {
      const url = el("input", {
        type: "url",
        placeholder: "https://example.com/image.jpg",
        value: value?.startsWith("data:") ? "" : (value ?? ""),
        oninput: (e) => set({ [f.key]: e.target.value }),
      });
      const file = el("input", {
        type: "file",
        accept: "image/*",
        hidden: true,
        onchange: () => {
          const reader = new FileReader();
          reader.onload = () => {
            set({ [f.key]: reader.result });
            redraw();
          };
          reader.readAsDataURL(file.files[0]);
        },
      });
      const uploaded = value?.startsWith("data:");
      return el(
        "div",
        { className: "field" },
        el("span", { textContent: f.label }),
        el(
          "div",
          { className: "row" },
          uploaded ? el("em", { textContent: "Uploaded image" }) : url,
          el("button", { type: "button", textContent: "Upload", onclick: () => file.click() }),
          value &&
            el("button", {
              type: "button",
              innerHTML: icon("close"),
              title: "Remove the image",
              onclick: () => {
                set({ [f.key]: "" });
                redraw();
              },
            }),
          file,
        ),
        hint,
      );
    }
    case "presets":
      return el(
        "div",
        { className: "field" },
        el("span", { textContent: f.label }),
        el(
          "div",
          { className: "row" },
          ...f.presets.map((p) =>
            el("button", {
              type: "button",
              textContent: p.label,
              onclick: () => {
                set(p.values);
                redraw();
              },
            }),
          ),
        ),
        hint,
      );
    case "textarea":
      return el(
        "label",
        { className: "field" },
        el("span", { textContent: f.label }),
        el("textarea", { value: value ?? "", rows: f.rows ?? 8, spellcheck: false, oninput: (e) => set({ [f.key]: e.target.value }) }),
        hint,
      );
    default:
      return el(
        "label",
        { className: "field" },
        el("span", { textContent: f.label }),
        el("input", {
          type: f.type ?? "text",
          value: value ?? "",
          placeholder: f.placeholder ?? "",
          min: f.min,
          max: f.max,
          oninput: (e) => set({ [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }),
        }),
        hint,
      );
  }
}

export { el };
