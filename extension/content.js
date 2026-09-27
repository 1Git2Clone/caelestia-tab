// Runs in every page. It owns what was injected into its own frame, so the
// background can be suspended and restarted without losing track: each update
// hands back the CSS applied last time for the background to swap out.
let applied = "";
let detected = null;
let queue = Promise.resolve();

function update() {
  queue = queue.then(async () => {
    try {
      applied = await browser.runtime.sendMessage({ type: "theme", url: location.href, applied, detected });
      // For userscripts: read the --caelestia-* variables again.
      document.dispatchEvent(new Event("caelestia-scheme"));
    } catch {
      // The extension was reloaded or the page is going away.
    }
  });
}

update();
// Styles the user also applies to pages by what they contain, wherever
// they're hosted: each override's "when" is a CSS selector, only answerable
// once the document is parsed, so those pages get a second update.
document.addEventListener("DOMContentLoaded", async () => {
  const { settings } = await browser.storage.local.get("settings");
  detected = Object.entries(settings?.sites?.overrides ?? {})
    .filter(([, o]) => {
      try {
        return o.when && document.querySelector(o.when);
      } catch {
        return false; // not a valid selector
      }
    })
    .map(([id]) => id);
  if (detected.length) update();
});
browser.storage.local.onChanged.addListener((changes) => {
  if (changes.scheme || changes.settings) update();
});
