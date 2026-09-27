import "./app.css";
import { mount } from "svelte";
import App from "./components/App.svelte";
import { start } from "./store.svelte.ts";

// Marks for timing a new tab (tests/newtab-speed.mjs): the state loaded, the
// page mounted.
performance.mark("ct-start");
const app = await start();
performance.mark("ct-state");
mount(App, { target: document.getElementById("app")!, props: { app } });
performance.mark("ct-mounted");
