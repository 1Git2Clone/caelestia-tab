<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";

  export const widget: WidgetInfo = {
    label: "Media",
    place: { justify: "center", align: "end" },
    defaults: { player: "spotify", art: true, width: 26 },
    fields: [
      { key: "player", label: "Prefer", type: "text", placeholder: "spotify", hint: "Part of a player's name. Without a match, whichever is playing." },
      { key: "art", label: "Show the cover", type: "checkbox" },
      { key: "width", label: "Width", type: "range", min: 16, max: 60, unit: "rem" },
    ],
  };

  // The player to show: the preferred one, else the one playing, else any.
  export function pick(players: any[], prefer: string) {
    const want = prefer.trim().toLowerCase();
    const named = want ? players.find((p) => `${p.identity} ${p.player}`.toLowerCase().includes(want)) : null;
    return named ?? players.find((p) => p.status === "Playing") ?? players[0] ?? null;
  }
</script>

<!-- What an MPRIS player (Spotify, mpv, a browser …) is playing, with its
     controls. The helper's media plugin reads the players and runs the
     commands; the position moves on here between its updates. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { tell, type App } from "../../store.svelte.ts";
  import CtIcon from "../CtIcon.svelte";

  let { settings }: { settings: any } = $props();
  const app = getContext<App>("ct");
  const p = $derived(pick(app.data.media?.players ?? [], settings.player));

  // The position MPRIS gave at `at`, moved on by the time since while playing.
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 500);
    return () => clearInterval(timer);
  });
  const position = $derived(p?.position == null ? null : p.position + (p.status === "Playing" ? (now - p.at) * 1000 * p.rate : 0));
  const progress = $derived(p?.length && position != null ? Math.min(1, position / p.length) : 0);
  const time = (us: number) => {
    const s = Math.max(0, Math.floor(us / 1e6));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const run = (command: string, extra = {}) => p && tell({ topic: "media", command, player: p.player, ...extra });
  function seek(e: MouseEvent) {
    if (!p?.canSeek || !p.length || !p.track) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    run("SetPosition", { track: p.track, position: Math.round(((e.clientX - r.left) / r.width) * p.length) });
  }
  const control = "grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-2 text-2xl text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)] disabled:cursor-default disabled:opacity-40";
  const play = "grid cursor-pointer place-items-center rounded-full border-0 bg-primary p-2.5 text-2xl text-on-primary";
</script>

<div
  class="ct-media box-border flex w-[min(var(--w),calc(100vw-2rem))] items-center gap-4 rounded-2xl bg-glass p-3 text-on-surface backdrop-blur-[10px] in-[.ct-edge-bottom]:rounded-b-none"
  style:--w="{settings.width}rem"
>
  {#if !p}
    <p class="m-0 px-2 text-on-surface-variant">
      {app.data.media ? "Nothing is playing." : "No media yet: the helper reads it from MPRIS."}
    </p>
  {:else}
    {#if settings.art}
      <div class="size-16 shrink-0 rounded-xl bg-surface-container-high bg-(image:--art) bg-cover bg-center" style:--art={p.art ? `url(${JSON.stringify(p.art)})` : "none"}></div>
    {/if}
    <div class="grid min-w-0 flex-1 gap-1">
      <div class="truncate font-medium">{p.title ?? p.identity}</div>
      <div class="truncate text-sm text-on-surface-variant">{p.artist || p.identity}</div>
      {#if p.length}
        <button type="button" class="ct-progress relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full border-0 bg-surface-container-highest p-0" title="Seek" aria-label="Seek" onclick={seek}>
          <span class="absolute inset-y-0 left-0 w-(--p) bg-primary" style:--p="{progress * 100}%"></span>
        </button>
        <div class="flex justify-between text-xs text-on-surface-variant tabular-nums">
          <span>{position == null ? "" : time(position)}</span><span>{time(p.length)}</span>
        </div>
      {/if}
    </div>
    <div class="flex items-center">
      <button type="button" class={control} title="Previous" disabled={!p.canPrevious} onclick={() => run("Previous")}><CtIcon name="previous" /></button>
      <button type="button" class={play} title={p.status === "Playing" ? "Pause" : "Play"} onclick={() => run("PlayPause")}>
        <CtIcon name={p.status === "Playing" ? "pause" : "play"} />
      </button>
      <button type="button" class={control} title="Next" disabled={!p.canNext} onclick={() => run("Next")}><CtIcon name="next" /></button>
    </div>
  {/if}
</div>
