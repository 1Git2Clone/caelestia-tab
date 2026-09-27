<script module lang="ts">
  import type { TabInfo } from "../../fields.ts";

  export const tab: TabInfo = {
    label: "GitHub",
    glyph: "", // nf-fa-github
    defaults: {
      searches: [
        "Your pull requests: is:open is:pr author:@me archived:false",
        "Review requests: is:open is:pr review-requested:@me archived:false",
        "Your issues: is:open is:issue assignee:@me archived:false",
      ].join("\n"),
      limit: 6,
      activity: true,
      updated: "Updated at",
      today: "HH:mm",
      yesterday: "[yesterday], HH:mm",
      older: "DD-MM-YYYY HH:mm",
    },
    fields: [
      {
        key: "searches",
        label: "Searches",
        type: "textarea",
        rows: 4,
        hint: "One per line, as Label: query, in GitHub's search syntax (is:pr, involves:@me, repo:owner/name …). Each is a column.",
      },
      { key: "limit", label: "Shown per search", type: "number", min: 1, max: 30 },
      { key: "activity", label: "Your recent activity", type: "checkbox", hint: "A column of what you did last on GitHub: pushes, pull requests, reviews, comments …" },
      { key: "updated", label: "Before the time of the last search", type: "text", placeholder: "Updated at" },
      {
        key: "today",
        label: "Time format, today",
        type: "text",
        hint: "YYYY, MM, DD, HH (24-hour), hh (12-hour), mm and A (AM or PM) are replaced; anything in [brackets] is kept as it is.",
      },
      { key: "yesterday", label: "Time format, yesterday", type: "text" },
      { key: "older", label: "Time format, before that", type: "text" },
    ],
  };

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

  function ago(iso: string, now = Date.now()) {
    const s = Math.max(0, (now - Date.parse(iso)) / 1000);
    for (const [unit, n] of [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]] as const) {
      if (s >= n) return `${Math.floor(s / n)}${unit}`;
    }
    return "now";
  }

  // A moment in one of the formats: today's, yesterday's or the older one.
  export function stamp(at: number, s: { today: string; yesterday: string; older: string }, now = new Date()) {
    const d = new Date(at);
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((day(now) - day(d)) / 86400000);
    const two = (n: number) => String(n).padStart(2, "0");
    const parts: Record<string, string> = {
      YYYY: String(d.getFullYear()),
      MM: two(d.getMonth() + 1),
      DD: two(d.getDate()),
      HH: two(d.getHours()),
      hh: two(d.getHours() % 12 || 12),
      mm: two(d.getMinutes()),
      A: d.getHours() < 12 ? "AM" : "PM",
    };
    const format = days === 0 ? s.today : days === 1 ? s.yesterday : s.older;
    return format.replace(/\[([^\]]*)\]|YYYY|MM|DD|HH|hh|mm|A/g, (m, kept) => kept ?? parts[m]);
  }
</script>

<!-- GitHub: each search of yours as a column of compact cards. The helper
     runs them (src/plugins/github.rs) with a token it finds itself. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { tell, type App } from "../../store.svelte.ts";
  import CtIcon from "../CtIcon.svelte";

  let { settings }: { settings: any } = $props();
  const app = getContext<App>("ct");

  const list = $derived(searches(settings.searches));
  const github = $derived(app.data.github);
  // Tell the helper what to search, once typing stops.
  $effect(() => {
    const queries = list.map((s) => s.query);
    const activity = settings.activity;
    // The helper answers from what it last fetched, unless a search is new:
    // opening the tab doesn't search again.
    const timer = setTimeout(() => tell({ topic: "github", command: "queries", widget: "CtGitHub", queries, activity }), 800);
    return () => clearTimeout(timer);
  });
  const PR = ""; // nf-oct-git_pull_request
  const ISSUE = ""; // nf-oct-issue_opened
  // An event's glyph, by its kind.
  const EVENT: Record<string, string> = {
    PushEvent: "\uf417", // nf-oct-git_commit
    PullRequestEvent: PR,
    PullRequestReviewEvent: "\uf4af", // nf-oct-code_review
    PullRequestReviewCommentEvent: "\uf4af",
    IssuesEvent: ISSUE,
    IssueCommentEvent: "\uf41f", // nf-oct-comment
    WatchEvent: "\uf41e", // nf-oct-star
    ForkEvent: "\uf402", // nf-oct-repo_forked
    CreateEvent: "\uf418", // nf-oct-git_branch
    DeleteEvent: "\uf48e", // nf-oct-trash
    ReleaseEvent: "\uf412", // nf-oct-tag
  };
  const control = "grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-2 text-2xl text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)]";
</script>

<div class="ct-github grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] content-start gap-4">
  <header class="col-span-full flex items-center gap-3 px-1">
    <span class="font-medium">GitHub</span>
    <span class="ml-auto text-sm text-on-surface-variant">
      <!-- A helper from before `at` and `activity` sends neither: say so,
           rather than wait for them. -->
      {#if github?.at}{settings.updated} {stamp(github.at, settings)}{:else if github && !("activity" in github)}Update the helper to see when it last fetched{:else if github}Not fetched yet{/if}
    </span>
    <button type="button" class={control} title="Fetch again now" onclick={() => tell({ topic: "github", command: "refresh" })}><CtIcon name="refresh" /></button>
  </header>
  {#if github?.error}
    <!-- What's shown stays; this says why it may be old. -->
    <p class="col-span-full m-0 px-1 text-sm text-on-surface-variant">
      {github.error}{#if github.limitedUntil}, until {stamp(github.limitedUntil, settings)}{/if}.
    </p>
  {/if}
  {#each list as s (s.query)}
    {@const r = github?.results?.[s.query]}
    <section class="grid min-w-0 content-start gap-2">
      <h3 class="m-0 flex items-baseline gap-2 px-1 text-sm font-medium text-primary">
        {s.label}
        {#if r?.total != null}<span class="text-xs text-on-surface-variant">{r.total}</span>{/if}
      </h3>
      {#if !r}
        <p class="m-0 px-1 text-sm text-on-surface-variant">{github ? "Searching…" : "Waiting for the helper."}</p>
      {:else if !r.items.length}
        <p class="m-0 px-1 text-sm text-on-surface-variant">Nothing.</p>
      {:else}
        {#each r.items.slice(0, settings.limit) as it (it.url)}
          {@render card(it.url, it.pr ? PR : ISSUE, `${it.repo}#${it.number}`, it.updated, it.title, it.pr ? (it.draft ? "Draft pull request" : "Pull request") : "Issue", !it.draft)}
        {/each}
      {/if}
    </section>
  {/each}
  {#if settings.activity}
    <section class="grid min-w-0 content-start gap-2">
      <h3 class="m-0 px-1 text-sm font-medium text-primary">Recent activity</h3>
      {#if !github?.activity}
        <p class="m-0 px-1 text-sm text-on-surface-variant">{!github ? "Waiting for the helper." : !("activity" in github) ? "Needs a newer helper." : "Fetching…"}</p>
      {:else if !github.activity.length}
        <p class="m-0 px-1 text-sm text-on-surface-variant">Nothing lately.</p>
      {:else}
        {#each github.activity.slice(0, settings.limit) as e, i (i)}
          {@render card(e.url, EVENT[e.kind] ?? "\uf469", e.repo, e.at, e.text, e.kind.replace(/Event$/, ""), true)}
        {/each}
      {/if}
    </section>
  {/if}
</div>

{#snippet card(url: string, glyph: string, where: string, when: string, text: string, kind: string, accent: boolean)}
  <a href={url} class="block min-w-0 rounded-xl bg-surface-container-high/70 px-3 py-2 text-on-surface no-underline hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_18%,var(--caelestia-surface-container-high))]">
    <div class="flex min-w-0 items-center gap-2 text-xs text-on-surface-variant">
      <span class="font-glyph text-sm {accent ? 'text-primary' : ''}" title={kind}>{glyph}</span>
      <span class="min-w-0 truncate">{where}</span>
      <span class="ml-auto shrink-0 tabular-nums">{ago(when)}</span>
    </div>
    <div class="mt-1 line-clamp-2 text-sm leading-snug">{text}</div>
  </a>
{/snippet}
