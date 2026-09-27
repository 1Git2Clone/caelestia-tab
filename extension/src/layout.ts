// Layout arithmetic and DOM helpers the components share.

// Even rows: as many columns as tiles of at least `min` px fit, then as few
// as still need that many rows, so 5 tiles that don't fit on one row go 3
// and 2, never 4 and 1. `spans` is each tile's width in columns.
export function evenColumns(width: number, min: number, gap: number, spans: number[]) {
  const fit = Math.max(1, Math.floor((width + gap) / (min + gap)));
  const total = spans.reduce((n, w) => n + Math.min(w, fit), 0);
  if (total <= fit) return Math.max(total, 1);
  return Math.max(Math.ceil(total / Math.ceil(total / fit)), ...spans.map((w) => Math.min(w, fit)));
}

// A Svelte action: marks which window edges the node touches with
// ct-edge-top/bottom/left/right, so a widget can square its corners there
// (`in-[.ct-edge-bottom]:rounded-b-none`). Rechecked on resize and zoom.
export function edges(node: HTMLElement) {
  const check = () => {
    const r = node.getBoundingClientRect();
    node.classList.toggle("ct-edge-top", r.top <= 1);
    node.classList.toggle("ct-edge-bottom", r.bottom >= innerHeight - 1);
    node.classList.toggle("ct-edge-left", r.left <= 1);
    node.classList.toggle("ct-edge-right", r.right >= innerWidth - 1);
  };
  const observer = new ResizeObserver(check);
  observer.observe(node);
  addEventListener("resize", check);
  return {
    destroy() {
      observer.disconnect();
      removeEventListener("resize", check);
    },
  };
}
