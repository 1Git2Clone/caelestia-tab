<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";

  export const widget: WidgetInfo = {
    label: "GitHub",
    place: { justify: "stretch", align: "start" },
    defaults: {
      searches: [
        "Your pull requests: is:open is:pr author:@me archived:false",
        "Review requests: is:open is:pr review-requested:@me archived:false",
        "Your issues: is:open is:issue assignee:@me archived:false",
      ].join("\n"),
      limit: 5,
    },
    fields: [
      {
        key: "searches",
        label: "Searches",
        type: "textarea",
        rows: 4,
        hint: "One per line, as Label: query, in GitHub's search syntax (is:pr, involves:@me, repo:owner/name …).",
      },
      { key: "limit", label: "Shown per search", type: "number", min: 1, max: 20 },
    ],
  };

  // "Label: query" lines; a line without a label is its own label.
  export function searches(text: string) {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const at = l.indexOf(": ");
        return at > 0 ? { label: l.slice(0, at), query: l.slice(at + 2).trim() } : { label: l, query: l };
      });
  }

  // "3h", "2d": how long ago an ISO time was.
  export function ago(iso: string, now = Date.now()) {
    const s = Math.max(0, (now - Date.parse(iso)) / 1000);
    for (const [unit, n] of [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]] as const) {
      if (s >= n) return `${Math.floor(s / n)}${unit}`;
    }
    return "now";
  }
</script>

<!-- GitHub searches: pull requests and issues, run by the helper's github
     plugin with the token it finds (see the handbook's GitHub chapter). The
     results live in storage, so every open tab shares one set of requests. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { tell, type App } from "../../store.svelte.ts";
  import CtIcon from "../CtIcon.svelte";

  let { id, settings }: { id: string; settings: any } = $props();
  const app = getContext<App>("ct");
  const list = $derived(searches(settings.searches));
  const data = $derived(app.data.github);

  // Tell the helper what this widget searches, once typing stops: it keeps
  // one list per widget id and searches all of them.
  $effect(() => {
    const queries = list.map((s) => s.query);
    const timer = setTimeout(() => tell({ topic: "github", command: "queries", widget: id, queries }), 800);
    return () => clearTimeout(timer);
  });

  const PR = ""; // nf-oct-git_pull_request
  const ISSUE = ""; // nf-oct-issue_opened
</script>

<div class="ct-github box-border grid min-w-0 gap-4 rounded-2xl bg-glass p-5 text-on-surface backdrop-blur-[10px] in-[.ct-edge-bottom]:rounded-b-none in-[.ct-edge-top]:rounded-t-none">
  <header class="flex items-center gap-2">
    <span class="font-glyph text-xl">{""}</span>
    <span class="flex-1 font-medium">GitHub</span>
    <button
      type="button"
      class="grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-1.5 text-on-surface-variant hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)]"
      title="Search again now"
      onclick={() => tell({ topic: "github", command: "refresh" })}><CtIcon name="refresh" /></button
    >
  </header>
  {#if data?.error}
    <p class="m-0 text-sm text-on-surface-variant">{data.error}</p>
  {/if}
  {#each list as s (s.query)}
    {@const r = data?.results?.[s.query]}
    <section class="grid min-w-0 gap-1.5">
      <h3 class="m-0 flex items-baseline gap-2 text-sm font-medium text-primary">
        {s.label}
        {#if r?.total != null}<span class="text-xs text-on-surface-variant">{r.total}</span>{/if}
      </h3>
      {#if r?.error}
        <p class="m-0 text-sm text-on-surface-variant">{r.error}</p>
      {:else if !r}
        <p class="m-0 text-sm text-on-surface-variant">{data ? "Searching…" : "Waiting for the helper."}</p>
      {:else if !r.items.length}
        <p class="m-0 text-sm text-on-surface-variant">Nothing.</p>
      {:else}
        <ul class="m-0 grid min-w-0 list-none gap-0.5 p-0">
          {#each r.items.slice(0, settings.limit) as it (it.url)}
            <li class="min-w-0">
              <a href={it.url} class="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-on-surface no-underline hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_14%,transparent)]">
                <span class="font-glyph {it.draft ? 'text-on-surface-variant' : 'text-primary'}" title={it.pr ? (it.draft ? "Draft pull request" : "Pull request") : "Issue"}>{it.pr ? PR : ISSUE}</span>
                <span class="min-w-0 flex-1 truncate">{it.title}</span>
                <span class="max-w-[45%] shrink-0 truncate text-xs text-on-surface-variant tabular-nums" title="{it.repo}#{it.number}">{it.repo}#{it.number} · {ago(it.updated)}</span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
</div>
