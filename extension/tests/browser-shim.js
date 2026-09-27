// The WebExtension API the new tab uses, standing in for the real one so
// Playwright can drive the built page as a normal web page. Storage lives in
// localStorage, so it survives a reload the way storage.local does; the
// helper is absent, as it would be when it isn't installed. The real
// extension, helper included, is covered by tests/e2e-firefox.mjs.
(() => {
  const KEY = "__caelestia_tab_storage";
  const read = () => JSON.parse(localStorage.getItem(KEY) ?? "null") ?? { scheme: window.__scheme ?? null };
  const listeners = [];
  const local = {
    get: async (keys) => {
      const all = read();
      const wanted = keys == null ? Object.keys(all) : [keys].flat();
      return Object.fromEntries(wanted.filter((k) => k in all).map((k) => [k, structuredClone(all[k])]));
    },
    set: async (items) => {
      const all = read();
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: all[k], newValue: structuredClone(v) };
        all[k] = v;
      }
      localStorage.setItem(KEY, JSON.stringify(all));
      setTimeout(() => listeners.forEach((l) => l(changes)), 0);
    },
    onChanged: { addListener: (l) => listeners.push(l) },
  };
  window.browser = {
    storage: { local },
    runtime: { connect: () => ({}), sendMessage: async () => {} },
    permissions: { contains: async () => true, request: async () => true },
  };
})();
