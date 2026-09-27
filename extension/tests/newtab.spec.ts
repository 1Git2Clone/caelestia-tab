// What a user does on the new tab: the pen, the side panel's editors, live
// edits, adding and removing widgets, and settings surviving a reload. Every
// test fails on any uncaught error on the page. A new interaction gets a test.
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

test("adding a widget opens its editor, and removing it takes it off the page", async ({ page }) => {
  const widgets = page.locator(".ct-widget");
  const before = await widgets.count();
  await page.getByTitle("Settings", { exact: true }).click();
  await panel(page).getByLabel("Widget to add").selectOption("CtClock");
  await panel(page).getByRole("button", { name: "Add", exact: true }).click();
  await expect(widgets).toHaveCount(before + 1);
  await expect(title(page)).toHaveText("Clock and date");
  await panel(page).getByRole("button", { name: "Remove this widget" }).click();
  await expect(widgets).toHaveCount(before);
  await expect(title(page)).toHaveText("Settings");
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

test("a user component is offered, placed and edited like ours", async ({ page }) => {
  await page.getByTitle("Settings", { exact: true }).click();
  await panel(page).getByLabel("Widget to add").selectOption("Hello");
  await panel(page).getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".hello")).toHaveText("Hello, world");
  await expect(title(page)).toHaveText("Hello");
  await box(page, "Greet").fill("caelestia");
  await expect(page.locator(".hello")).toHaveText("Hello, caelestia");
});

test("a widget whose component isn't built stays removable from edit mode", async ({ page }) => {
  await page.evaluate(async () => {
    const { settings } = await (window as any).browser.storage.local.get("settings");
    const s = settings ?? {};
    s.widgets = [...(s.widgets ?? []), { id: "gone", component: "NotBuilt", place: { area: "auto", justify: "start", align: "start" }, settings: {} }];
    await (window as any).browser.storage.local.set({ settings: s });
  });
  await page.reload();
  await page.getByTitle("Edit", { exact: true }).click();
  await expect(page.getByText("No component called NotBuilt in this build.")).toBeVisible();
  await page.getByTitle("Edit NotBuilt").click();
  await panel(page).getByRole("button", { name: "Remove this widget" }).click();
  await expect(page.getByText("No component called NotBuilt")).toHaveCount(0);
});

test("a widget laid over the toolbar leaves its buttons clickable", async ({ page }) => {
  await page.evaluate(async () => {
    const { settings } = await (window as any).browser.storage.local.get("settings");
    const s = settings ?? {};
    s.widgets = [...(s.widgets ?? []), { id: "over", component: "Hello", place: { area: "toolbar", justify: "stretch", align: "stretch" }, settings: {} }];
    await (window as any).browser.storage.local.set({ settings: s });
  });
  await page.reload();
  await expect(page.locator(".hello")).toBeVisible();
  await page.getByTitle("Settings", { exact: true }).click({ timeout: 2000 });
  await expect(panel(page)).toBeVisible();
});
