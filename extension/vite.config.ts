import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vite";

// The user's own components, built in with ours: every .svelte file there.
// Ours are named Ct*; a user file with that prefix would stand in for one of
// ours (or be shadowed by it), so the build refuses it.
const user = path.resolve(process.env.CAELESTIA_TAB_COMPONENTS ?? path.join(os.homedir(), ".config/caelestia-tab/components"));
const files = fs.existsSync(user) ? (fs.readdirSync(user, { recursive: true }) as string[]).filter((f) => f.endsWith(".svelte")) : [];
const taken = files.filter((f) => path.basename(f).startsWith("Ct"));
if (taken.length) {
  throw new Error(`${taken.map((f) => path.join(user, f)).join(", ")}: the Ct prefix is reserved for caelestia-tab's own components; rename ${taken.length > 1 ? "them" : "it"}.`);
}
// Tailwind scans the user's folder too, through an @source this writes (it
// can't read an environment variable itself). Generated; not committed.
fs.writeFileSync(path.resolve("src/user-source.css"), files.length ? `@source ${JSON.stringify(user)};\n` : "/* No user components. */\n");

// Two builds into dist/ (see package.json): the extension's pages, and, with
// --ssr, the same components compiled for svelte/server, which the background
// uses to render the new tab ahead of time (src/render.ts).
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [tailwindcss(), svelte()],
  // $ct is ours, for user components to import from; $user is theirs.
  resolve: { alias: { $ct: path.resolve("src"), $user: user } },
  server: { fs: { allow: [".", user] } },
  // Extension pages load from moz-extension://<id>/, so every URL is relative.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: !isSsrBuild,
    target: "firefox128",
    // Readable output: the add-on stores ask for it, and so does debugging.
    minify: false,
    modulePreload: false,
    rollupOptions: isSsrBuild
      ? {
          // Only svelte/server's async rendering loads it, and a failed load
          // there is caught; render.ts renders synchronously.
          external: ["node:async_hooks"],
          output: { entryFileNames: "render.js" },
        }
      : {
          input: { newtab: "newtab.html", background: "src/background.ts" },
          output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name].js", assetFileNames: "assets/[name][extname]" },
        },
  },
  // Everything in the one file: the background imports render.js as it is.
  ssr: { noExternal: true, target: "webworker" },
}));
