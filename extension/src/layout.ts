// Layout arithmetic and DOM helpers the components share.

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
