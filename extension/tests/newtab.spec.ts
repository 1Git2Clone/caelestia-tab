// What a user does on the new tab: the pen, the side panel's editors, live
// edits, the menu and its tabs, and settings surviving a reload. Every test
// fails on any uncaught error on the page. A new interaction gets a test.
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const SCHEME = {
  name: "ui",
  flavour: "default",
  mode: "dark",
  variant: "tonalspot",
  colours: Object.fromEntries(["primary", "onPrimary", "surface", "onSurface", "background", "shadow", "outlineVariant"].map((n) => [n, "445566"])),
};

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.addInitScript(`window.__scheme = ${JSON.stringify(SCHEME)};`);
  await page.addInitScript({ path: path.join(import.meta.dirname, "browser-shim.js") });
  await page.goto("/newtab.html");
  await expect(page.locator(".ct-clock")).toBeVisible();
});
test.afterEach(() => expect(errors, "no uncaught errors on the page").toEqual([]));

const panel = (page: Page) => page.locator(".ct-settings");
const title = (page: Page) => panel(page).getByRole("heading", { level: 2 });
const box = (page: Page, name: string) => panel(page).getByRole("textbox", { name, exact: true });

test("the pen opens a widget in the side panel, and its edits show live", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.getByTitle("Edit Clock and date").click();
  await expect(title(page)).toHaveText("Clock and date");
  await box(page, "Time separator").fill("~");
  await expect(page.locator(".ct-clock")).toContainText("~");
});

test("a bookmark's tile and the panel's title follow its name", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.locator(".ct-controls").first().getByTitle("Edit").click();
  await box(page, "Name").fill("Forgejo here");
  await expect(title(page)).toHaveText("Forgejo here");
  await expect(page.locator(".ct-tile").first()).toContainText("Forgejo here");
});

test("glyph suggestions follow the bookmark's name", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.locator(".ct-controls").first().getByTitle("Edit").click();
  // Without an address, so only the name decides.
  await panel(page).getByRole("tab", { name: "Address" }).click();
  await box(page, "URL").fill("");
  await panel(page).getByRole("tab", { name: "Look" }).click();
  await box(page, "Name").fill("GitHub");
  await expect(panel(page).getByTitle("nf-fa-github", { exact: true }).first()).toBeVisible();
  await box(page, "Name").fill("Discord");
  await expect(panel(page).getByTitle(/discord/).first()).toBeVisible();
  await expect(panel(page).getByTitle("nf-fa-github", { exact: true })).toHaveCount(0);
});

test("a field only shows when it applies", async ({ page }) => {
  await page.getByTitle("Settings", { exact: true }).click();
  await panel(page).getByRole("tab", { name: "Background" }).click();
  const source = panel(page).getByRole("combobox", { name: "Background" });
  await source.selectOption("wallpaper");
  await expect(panel(page).getByRole("radiogroup", { name: "Colour" })).toHaveCount(0);
  await expect(panel(page).getByRole("slider", { name: /^Blur/ })).toBeVisible();
  await source.selectOption("colour");
  await expect(panel(page).getByRole("radiogroup", { name: "Colour" })).toBeVisible();
  await expect(panel(page).getByRole("slider", { name: /^Blur/ })).toHaveCount(0);
});

test("a site of your own is added from the filter, by Enter or its + row", async ({ page }) => {
  await page.getByTitle("Settings", { exact: true }).click();
  await panel(page).getByRole("tab", { name: "Websites" }).click();
  const filter = panel(page).getByRole("searchbox", { name: "Filter sites" });
  await filter.fill("Navidrome");
  await expect(panel(page).getByRole("button", { name: /Add “Navidrome”/ })).toBeVisible();
  await filter.press("Enter");
  // Added, and open for its domains and CSS.
  const on = panel(page).getByRole("textbox", { name: "On", exact: true });
  await expect(on).toBeVisible();
  await on.fill("music.example.com");
  await panel(page).getByRole("textbox", { name: "Your CSS" }).fill("body { background: var(--caelestia-surface); }");
  await filter.fill("Jellyfin");
  await panel(page).getByRole("button", { name: /Add “Jellyfin”/ }).click();
  const { sites } = (await page.evaluate(() => (window as any).browser.storage.local.get("settings"))).settings;
  expect(sites.custom.map((c: any) => c.name)).toEqual(["Navidrome", "Jellyfin"]);
  expect(sites.overrides[sites.custom[0].id].domains).toBe("music.example.com");
  await panel(page).getByRole("button", { name: "Remove this site" }).click();
  await expect.poll(async () => (await page.evaluate(() => (window as any).browser.storage.local.get("settings"))).settings.sites.custom.length).toBe(1);
});

test("Escape steps out of an editor, then closes the panel", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.locator(".ct-controls").first().getByTitle("Edit").click();
  await expect(title(page)).not.toHaveText("Settings");
  await page.keyboard.press("Escape");
  await expect(title(page)).toHaveText("Settings");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
});

test("edits survive a reload", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.getByTitle("Edit Clock and date").click();
  await box(page, "Time separator").fill("~");
  await page.locator(".ct-controls").first().getByTitle("Edit").click();
  await box(page, "Name").fill("Kept");
  // Saving is an effect after the change; give it its turn before reloading.
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator(".ct-clock")).toContainText("~");
  await expect(page.locator(".ct-tile").first()).toContainText("Kept");
});

// Puts values in storage as the helper would, then loads the page again.
async function seed(page: Page, values: Record<string, unknown>) {
  await page.evaluate(async (v) => {
    const { settings } = await (window as any).browser.storage.local.get("settings");
    const s = settings ?? {};
    for (const [k, x] of Object.entries(v)) if (k === "settings") Object.assign(s, x);
    await (window as any).browser.storage.local.set({ ...v, settings: s });
  }, values);
  await page.reload();
}
const menuButton = (page: Page) => page.getByRole("button", { name: /the menu$/ });
const tabButton = (page: Page, name: string) => page.locator(".ct-menu nav").getByRole("button", { name, exact: true });

test("the menu opens on the tab last shown, and stays as it was left after a reload", async ({ page }) => {
  await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");
  await menuButton(page).click();
  await expect(page.locator(".ct-clock")).toHaveCount(0);
  await tabButton(page, "Media").click();
  await expect(tabButton(page, "Media")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".ct-media")).toBeVisible();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(menuButton(page)).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".ct-media")).toBeVisible();
  await menuButton(page).click();
  await expect(page.locator(".ct-clock")).toBeVisible();
});

test("the clock can't be edited while a tab covers it, and the open tab can", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await expect(page.getByTitle("Edit Clock and date")).toBeVisible();
  await menuButton(page).click();
  await tabButton(page, "GitHub").click();
  await expect(page.getByTitle("Edit Clock and date")).toHaveCount(0);
  await page.getByTitle("Edit GitHub").click();
  await expect(title(page)).toHaveText("GitHub");
  await box(page, "Before the time of the last search").fill("Last refresh:");
  await seed(page, { github: { at: Date.now(), results: {} } });
  await expect(page.locator(".ct-github header")).toContainText("Last refresh:");
});

test("the pen's outline is drawn inside each part, and the menu has its own", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await expect(page.locator(".ct-edit").first()).toHaveCSS("outline-offset", "-2px");
  await expect(page.getByTitle("Edit Menu")).toBeVisible();
  await menuButton(page).click();
  await expect(page.getByTitle("Edit Menu")).toBeVisible();
  await page.getByTitle("Edit Menu").click();
  await expect(title(page)).toHaveText("Menu");
});

test("GitHub's last search shows in the tab's formats", async ({ page }) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(9, 5);
  await seed(page, { github: { at: yesterday.getTime(), results: {} }, settings: { menu: { open: true, tab: "CtGitHub", tabs: {} } } });
  await expect(page.locator(".ct-github header")).toContainText("Updated at yesterday, 09:05");
});

test("GitHub shows your activity, and a rate limit keeps the last results", async ({ page }) => {
  const q = "is:open is:pr author:@me archived:false";
  const card = { url: "https://github.com/a/b/pull/1", repo: "a/b", number: 1, title: "Kept PR", pr: true, draft: false, updated: new Date().toISOString() };
  const until = new Date();
  until.setHours(23, 40);
  await seed(page, {
    github: {
      at: Date.now(),
      results: { [q]: { total: 1, items: [card] } },
      activity: [{ kind: "PushEvent", repo: "a/b", text: "Pushed 2 commits to main", url: "https://github.com/a/b/commits/main", at: new Date().toISOString() }],
      error: "GitHub said 403: API rate limit exceeded",
      limitedUntil: until.getTime(),
    },
    settings: { menu: { open: true, tab: "CtGitHub", tabs: {} } },
  });
  const tab = page.locator(".ct-github");
  await expect(tab.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  await expect(tab.getByRole("link", { name: /Pushed 2 commits to main/ })).toHaveAttribute("href", "https://github.com/a/b/commits/main");
  await expect(tab.getByRole("link", { name: /Kept PR/ })).toBeVisible();
  await expect(tab).toContainText("API rate limit exceeded, until 23:40.");
  // The time sits beside the refresh button.
  const stamp = (await tab.getByText(/^Updated at /).boundingBox())!;
  const refresh = (await tab.getByTitle("Fetch again now").boundingBox())!;
  expect(refresh.x - (stamp.x + stamp.width)).toBeLessThan(40);
});

test("activity is a line of the searches, once, and the private toggle swaps every column for its public twin", async ({ page }) => {
  // Shaped like the helper's: both twins of a search are kept, and both lists of events.
  const push = (repo: string) => ({ kind: "PushEvent", repo, text: "Pushed 16bdf70 to main", url: `https://github.com/${repo}/commit/16bdf70a055fcb73fb5a120822ce9c66029b11e7`, at: new Date().toISOString() });
  const pr = (repo: string) => ({ url: `https://github.com/${repo}/pull/1`, repo, number: 1, title: `PR in ${repo}`, pr: true, draft: false, updated: new Date().toISOString() });
  const q = "is:pr author:@me";
  await seed(page, {
    github: {
      at: Date.now(),
      results: { [q]: { total: 2, items: [pr("me/secret"), pr("me/open")] }, [`${q} is:public`]: { total: 1, items: [pr("me/open")] } },
      activity: [push("me/secret")],
      publicActivity: [push("me/open")],
    },
    settings: { menu: { open: true, tab: "CtGitHub", tabs: { CtGitHub: { searches: `PRs: ${q}\nMine: @activity\nAgain: @activity\nHalf typed:` } } } },
  });
  const tab = page.locator(".ct-github");
  await expect(tab.getByRole("heading", { level: 3 })).toHaveText([/^PRs\s*2$/, "Mine"]);
  // On: the private repository in the search and in the activity.
  await expect(tab.getByRole("link", { name: /me\/secret/ })).toHaveCount(2);
  await page.getByTitle("Edit", { exact: true }).click();
  await page.getByTitle("Edit GitHub").click();
  const toggle = panel(page).getByRole("checkbox", { name: "Private activity" });
  await toggle.uncheck();
  await expect(tab.getByRole("link", { name: /PR in me\/open/ })).toBeVisible();
  await expect(tab.getByRole("link", { name: /Pushed 16bdf70 to main/ })).toHaveAttribute("href", /me\/open\/commit\//);
  await expect(tab.getByRole("link", { name: /me\/secret/ })).toHaveCount(0);
  // And the helper is told, so it fetches the public twins.
  await expect.poll(() => page.evaluate(() => (window as any).__sent?.findLast((m: any) => m.message?.command === "queries")?.message)).toMatchObject({ queries: [`${q} is:public`], activity: true, private: false });
  await toggle.check();
  // On: the private repository in the search and in the activity.
  await expect(tab.getByRole("link", { name: /me\/secret/ })).toHaveCount(2);
});

test("the refresh icon spins until the helper answers", async ({ page }) => {
  await seed(page, { github: { at: 1, results: {} }, settings: { menu: { open: true, tab: "CtGitHub", tabs: {} } } });
  await page.getByTitle("Fetch again now").click();
  const busy = page.getByTitle("Fetching…");
  await expect(busy).toBeDisabled();
  await expect(busy.locator(".animate-spin")).toBeVisible();
  await page.evaluate(() => (window as any).browser.storage.local.set({ github: { at: Date.now(), results: {} } }));
  await expect(page.getByTitle("Fetch again now")).toBeEnabled();
  await expect(page.locator(".ct-github .animate-spin")).toHaveCount(0);
});

test("a helper too old for the time and activity says so, rather than wait", async ({ page }) => {
  await seed(page, { github: { results: {} }, settings: { menu: { open: true, tab: "CtGitHub", tabs: {} } } });
  const tab = page.locator(".ct-github");
  await expect(tab).toContainText("Update the helper to see when it last fetched");
  await expect(tab).toContainText("Needs a newer helper.");
  await expect(tab).not.toContainText("Not fetched yet");
});

test("the toolbar on the left puts the menu on the right, its button at the edge", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.getByTitle("Edit Toolbar").click();
  await panel(page).getByRole("combobox", { name: "Side" }).selectOption("start");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await menuButton(page).click();
  const toolbar = (await page.locator(".ct-toolbar").boundingBox())!;
  const menu = (await menuButton(page).boundingBox())!;
  const github = (await tabButton(page, "GitHub").boundingBox())!;
  expect(menu.x).toBeGreaterThan(toolbar.x);
  expect(menu.x).toBeGreaterThan(github.x);
});

test("a user's tab is offered and edited like ours", async ({ page }) => {
  await menuButton(page).click();
  await tabButton(page, "Hello").click();
  await expect(page.locator(".hello")).toHaveText("Hello, world");
  await page.getByTitle("Edit", { exact: true }).click();
  await page.getByTitle("Edit Hello").click();
  await box(page, "Greet").fill("caelestia");
  await expect(page.locator(".hello")).toHaveText("Hello, caelestia");
});

const players = (n: number) => ({
  players: Array.from({ length: n }, (_, i) => ({
    player: `org.mpris.MediaPlayer2.p${i}`,
    identity: `Player ${i}`,
    status: i === 1 ? "Playing" : "Paused",
    title: `Song ${i}`,
    artist: "Artist",
    album: "Album",
    position: 0,
    at: Date.now(),
    rate: 1,
    canSeek: true,
    track: `/t/${i}`,
  })),
});

test("each player is a tab, and the last row of them fills the width", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await seed(page, { media: players(5), settings: { menu: { open: true, tab: "CtMedia", tabs: {} } } });
  const tabs = page.getByRole("group", { name: "Players" }).getByRole("button");
  await expect(tabs).toHaveCount(5);
  // The one playing is shown until another is picked.
  await expect(page.locator(".ct-media")).toContainText("Song 1");
  const first = (await tabs.nth(0).boundingBox())!;
  const last = (await tabs.nth(4).boundingBox())!;
  expect(last.width).toBeGreaterThan(first.width * 3.5);
  await tabs.nth(3).click();
  await expect(page.locator(".ct-media")).toContainText("Song 3");
  await expect(page.locator(".ct-media")).toContainText("Album • Artist");
});

test("a lyric line clicked plays from its start", async ({ page }) => {
  await seed(page, {
    media: players(1),
    lyrics: { key: "artist\u001fsong 0", synced: [{ ms: 0, text: "one" }, { ms: 12500, text: "two" }] },
    settings: { menu: { open: true, tab: "CtMedia", tabs: {} } },
  });
  await page.getByRole("button", { name: "two" }).click();
  const sent = () => page.evaluate(() => (window as any).__sent?.map((m: any) => m.message) ?? []);
  await expect.poll(async () => (await sent()).find((m: any) => m.command === "SetPosition")).toMatchObject({ player: "org.mpris.MediaPlayer2.p0", track: "/t/0", position: 12500000 });
});

test("scrolling the lyrics stops them following, until the current line is back in view", async ({ page }) => {
  const at = (line: number) => ({ players: [{ ...players(1).players[0], status: "Paused", position: line * 2000 * 1000, at: Date.now() }] });
  await seed(page, {
    media: at(30),
    lyrics: { key: "artist\u001fsong 0", synced: Array.from({ length: 60 }, (_, i) => ({ ms: i * 2000, text: `line ${i}` })) },
    settings: { menu: { open: true, tab: "CtMedia", tabs: {} } },
  });
  const lyrics = page.locator(".ct-lyrics");
  const top = () => lyrics.evaluate((el) => el.scrollTop);
  const shown = (text: string) =>
    lyrics.evaluate((el, text) => {
      const line = [...el.querySelectorAll("button")].find((b) => b.textContent === text)!.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return line.bottom > box.top && line.top < box.bottom;
    }, text);
  await expect.poll(() => shown("line 30")).toBe(true);
  await expect.poll(top).toBeGreaterThan(100);

  // Scrolled away from the current line: it stays where you left it.
  await lyrics.hover();
  // Firefox caps how far one wheel event goes: several, like a real wheel.
  for (let i = 0; i < 30 && (await top()) > 0; i++) await page.mouse.wheel(0, -400);
  await expect.poll(top).toBe(0);
  await page.waitForTimeout(2000);
  expect(await top()).toBe(0);
  await page.evaluate((media) => (window as any).browser.storage.local.set({ media }), at(40));
  await page.waitForTimeout(600);
  expect(await top()).toBe(0);

  // Scrolled back to it: after a moment, it follows again.
  while (!(await shown("line 40"))) await page.mouse.wheel(0, 200);
  await page.waitForTimeout(2000);
  await page.evaluate((media) => (window as any).browser.storage.local.set({ media }), at(55));
  await expect.poll(() => shown("line 55")).toBe(true);
});

test("a bookmark's colour can be changed again and again", async ({ page }) => {
  await page.getByTitle("Edit", { exact: true }).click();
  await page.locator(".ct-controls").first().getByTitle("Edit").click();
  const colours = panel(page).getByRole("radiogroup", { name: "Colour", exact: true });
  const tile = page.locator(".ct-tile").first();
  for (const name of ["Secondary", "Tertiary", "Primary container", "Secondary"]) {
    await colours.getByRole("radio", { name, exact: true }).click();
    await expect(colours.getByRole("radio", { name, exact: true })).toHaveAttribute("aria-checked", "true");
    const token = { Secondary: "secondary", Tertiary: "tertiary", "Primary container": "primary-container" }[name];
    await expect(tile).toHaveAttribute("style", new RegExp(`--tile: var\\(--caelestia-${token}\\)`));
    // Another tab, or the settings file, replaces the settings meanwhile:
    // the open editor must still edit the bookmark on the page.
    await page.evaluate(async () => {
      const store = (window as any).browser.storage.local;
      const { settings } = await store.get("settings");
      settings.clock.timeSeparator = `${Math.random()}`;
      await store.set({ settings: JSON.parse(JSON.stringify(settings)) });
    });
  }
});

test("a bookmark's line matches its colour, or is its own, or none", async ({ page }) => {
  const tile = page.locator(".ct-tile").first();
  await expect(tile).toHaveCSS("border-bottom-width", "3px");
  await page.getByTitle("Edit", { exact: true }).click();
  await page.locator(".ct-controls").first().getByTitle("Edit").click();
  const line = panel(page).getByRole("combobox", { name: "Line under it" });
  await expect(panel(page).getByRole("radiogroup", { name: "Line colour" })).toHaveCount(0);
  await line.selectOption("colour");
  await expect(panel(page).getByRole("radiogroup", { name: "Line colour" })).toBeVisible();
  await line.selectOption("none");
  await page.getByTitle("Done editing").click();
  await expect(tile).toHaveCSS("border-bottom-width", "0px");
});

test("settings from when the page was a grid of widgets keep each part's", async ({ page }) => {
  await page.evaluate(async () => {
    await (window as any).browser.storage.local.set({
      settings: {
        layout: { areas: '"toolbar" "clock" "bookmarks"' },
        widgets: [
          { id: "toolbar", component: "CtToolbar", place: {}, settings: { settings: true, edit: true, actions: true } },
          { id: "clock", component: "CtClock", place: {}, settings: { timeSeparator: "~" } },
          { id: "bookmarks", component: "CtBookmarks", place: {}, settings: { items: [{ id: "a", name: "Kept", url: "", colour: "primary", showName: true, width: 1, height: 1 }] } },
        ],
      },
    });
  });
  await page.reload();
  await expect(page.locator(".ct-clock")).toContainText("~");
  await expect(page.locator(".ct-tile")).toHaveText(/Kept/);
});

test("the page's padding is one setting, or two when untied", async ({ page }) => {
  const main = page.locator(".ct-page");
  await expect(main).toHaveCSS("padding-top", "40px");
  await expect(main).toHaveCSS("padding-left", "40px");
  await page.keyboard.press("Control+,");
  await panel(page).getByRole("slider", { name: "Padding" }).fill("4");
  await expect(main).toHaveCSS("padding-top", "64px");
  await expect(main).toHaveCSS("padding-right", "64px");
  await panel(page).getByRole("checkbox", { name: "Same on every side" }).uncheck();
  await panel(page).getByRole("slider", { name: "Vertical" }).fill("1");
  await expect(main).toHaveCSS("padding-top", "16px");
  await expect(main).toHaveCSS("padding-left", "64px");
});
