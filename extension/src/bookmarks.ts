// The bookmarks' grid settings were CSS strings (grid-template-columns and
// the like, and "even rows"); they're numbers now. This takes an older
// shape to the new one, keeping only what it can read: complete() fills the
// rest from the defaults.

const rem = (v: unknown) => {
  const m = /^\s*(\d*\.?\d+)\s*rem\s*$/.exec(String(v));
  return m ? Number(m[1]) : undefined;
};

export function bookmarkOptions(saved: Record<string, any>): Record<string, any> {
  const { even, tileWidth, columns, rows, ...s } = saved;
  const repeat = /^\s*repeat\(\s*(\d+)\s*,/.exec(String(columns ?? ""));
  if (s.count === undefined && repeat) s.count = Number(repeat[1]);
  if (s.rowHeight === undefined && rows !== undefined) s.rowHeight = rem(rows);
  if (typeof s.gap === "string") s.gap = rem(s.gap);
  if (typeof s.flow === "string") s.flow = s.flow.startsWith("column") ? "column" : "row";
  for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
  return s;
}
