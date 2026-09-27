import "./app.css";
import { mount } from "svelte";
import App from "./components/App.svelte";
import { start } from "./store.svelte.ts";

mount(App, { target: document.getElementById("app")!, props: { app: await start() } });
