import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Two builds into dist/ (see package.json): the extension's pages, and, with
// --ssr, the same components compiled for svelte/server, which the background
// uses to render the new tab ahead of time (src/render.ts).
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [tailwindcss(), svelte()],
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
