// The new tab rendered ahead of time, for the background (see the snapshot in
// background.ts). Built with `vite build --ssr`, so the components here are
// compiled for svelte/server.
import { render as renderSvelte } from "svelte/server";
import App from "./components/App.svelte";
import type { App as State } from "./store.svelte.ts";

export const render = (app: State) => renderSvelte(App, { props: { app } });
