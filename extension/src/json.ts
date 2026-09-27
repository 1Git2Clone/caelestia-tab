// JSON with every object's keys in order, for telling whether two settings
// objects hold the same thing: the helper's settings file comes back with
// its keys sorted (serde_json's maps are), so plain JSON.stringify calls
// the same settings different.
export const stable = (value: unknown) =>
  JSON.stringify(value, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v));
