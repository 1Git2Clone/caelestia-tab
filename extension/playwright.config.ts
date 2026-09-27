import { defineConfig, devices } from "@playwright/test";

// The new tab's UI, in Firefox, as a page with the extension API stood in
// (tests/browser-shim.js). It builds its own copy, into test-dist/, with the
// user components in tests/fixtures rather than the ones in the user's home.
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173", viewport: { width: 1600, height: 900 } },
  projects: [{ name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1600, height: 900 } } }],
  webServer: {
    command: "CAELESTIA_TAB_COMPONENTS=tests/fixtures npx vite build --outDir test-dist && npx vite preview --outDir test-dist --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173/newtab.html",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
