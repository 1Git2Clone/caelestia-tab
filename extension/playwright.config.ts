import { defineConfig, devices } from "@playwright/test";

// The new tab's UI, in Firefox, as a page served from dist/ with the
// extension API stood in (tests/browser-shim.js). Build first:
// `npm run build && npx playwright test`.
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173", viewport: { width: 1600, height: 900 } },
  projects: [{ name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1600, height: 900 } } }],
  webServer: { command: "npx vite preview --port 4173 --strictPort --host 127.0.0.1", url: "http://127.0.0.1:4173/newtab.html", reuseExistingServer: false },
});
