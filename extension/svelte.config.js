import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// vitePreprocess covers <script lang="ts"> and <style lang="scss"> alike, so
// components can use either, or neither.
export default { preprocess: vitePreprocess() };
