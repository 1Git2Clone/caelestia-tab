// Runs in every page. It owns what was injected into its own frame, so the
// background can be suspended and restarted without losing track: each update
// hands back the CSS applied last time for the background to swap out.
let applied = "";
let queue = Promise.resolve();

function update() {
  queue = queue.then(async () => {
    try {
      applied = await browser.runtime.sendMessage({ type: "theme", url: location.href, applied });
      // For userscripts: read the --caelestia-* variables again.
      document.dispatchEvent(new Event("caelestia-scheme"));
    } catch {
      // The extension was reloaded or the page is going away.
    }
  });
}

update();
browser.storage.local.onChanged.addListener((changes) => {
  if (changes.scheme || changes.settings) update();
});
