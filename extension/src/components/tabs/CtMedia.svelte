<script module lang="ts">
  import type { TabInfo } from "../../fields.ts";

  export const tab: TabInfo = {
    label: "Media",
    glyph: "", // nf-fa-music
    defaults: { player: "", lyrics: true, cover: 16, left: 22 },
    fields: [
      { key: "lyrics", label: "Look up lyrics", type: "checkbox", hint: "From lrclib.net when the player sends none: the artist, title and album go there." },
      { key: "cover", label: "Cover size", type: "range", min: 6, max: 30, step: 0.5, unit: "rem" },
      {
        key: "left",
        label: "Cover's column",
        type: "range",
        min: 12,
        max: 40,
        step: 0.5,
        unit: "rem",
        hint: "With room for the lyrics beside it, the cover and the controls take this much and the lyrics the rest; without, they're one column.",
      },
    ],
  };

  // The player shown: the one picked last, else the one playing, else any.
  export function pick(players: any[], picked: string) {
    return players.find((p) => p.player === picked) ?? players.find((p) => p.status === "Playing") ?? players[0] ?? null;
  }

  // Grid spans (of 12) for `n` source tabs in `cols` columns: the last row's
  // share the whole width between them.
  export function spans(n: number, cols: number) {
    const last = n % cols || cols;
    return Array.from({ length: n }, (_, i) => (i >= n - last ? 12 / last : 12 / cols));
  }

  // The helper's lyrics key for a track (src/plugins/lyrics.rs).
  const lyricsKey = (artist: string, title: string) => `${artist.trim().toLowerCase()}\u001f${title.trim().toLowerCase()}`;
</script>

<!-- What an MPRIS player is playing (src/plugins/media.rs), a tab per player
     at the top, and the lyrics: the player's own, or LRCLIB's. Side by side
     when there's room, one column when there isn't. -->
<script lang="ts">
  import { getContext } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { tell, type App } from "../../store.svelte.ts";
  import CtIcon from "../CtIcon.svelte";
  import CtMarquee from "../CtMarquee.svelte";

  let { settings }: { settings: any } = $props();
  const app = getContext<App>("ct");

  const players: any[] = $derived(app.data.media?.players ?? []);
  const p = $derived(pick(players, settings.player));
  // Another player slides in from the side its tab is on, like the menu's tabs.
  let dir = $state(1);
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function choose(q: any) {
    dir = players.indexOf(q) >= players.findIndex((x) => x.player === p?.player) ? 1 : -1;
    settings.player = q.player;
  }
  let width = $state(0);
  const rem = $derived(typeof document === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  // Four source tabs a row, two on a narrow page.
  const cols = $derived(width >= 40 * rem ? 4 : 2);
  const span = $derived(spans(players.length, cols));
  // Beside each other once the lyrics get at least 20rem of their own.
  const wide = $derived(width >= (settings.left + 20) * rem);

  // The position MPRIS gave at `at`, moved on while playing.
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 250);
    return () => clearInterval(timer);
  });
  const position = $derived(p?.position == null ? null : p.position + (p.status === "Playing" ? (now - p.at) * 1000 * p.rate : 0));
  const run = (command: string) => p && tell({ topic: "media", command, player: p.player });
  const line = $derived([p?.album, p?.artist].filter(Boolean).join(" • "));

  // Lyrics: the player's own, or the helper's lookup for this track.
  $effect(() => {
    if (!p?.title || p.lyrics || !settings.lyrics) return;
    tell({ topic: "lyrics", command: "get", artist: p.artist ?? "", title: p.title, album: p.album ?? "", seconds: (p.length ?? 0) / 1e6 });
  });
  const found = $derived(p?.title && app.data.lyrics?.key === lyricsKey(p.artist ?? "", p.title) ? app.data.lyrics : null);
  const synced: { ms: number; text: string }[] = $derived(found?.synced ?? []);
  const plain = $derived(p?.lyrics || found?.plain || "");
  const current = $derived(position == null ? -1 : synced.findLastIndex((l) => l.ms <= position / 1000));
  const seekable = $derived(!!(p?.canSeek && p.track));
  // The lyrics follow the song, until you scroll them. Once you've stopped
  // for a moment, they follow again if the current line is in view; if it
  // isn't, they wait for your next scroll (or a click, or the next song).
  let lyricsBox: HTMLElement | undefined = $state();
  let held = $state(false);
  let idle: ReturnType<typeof setTimeout> | undefined;
  const currentLine = () => lyricsBox?.querySelector<HTMLElement>(`[data-line="${current}"]`);
  function inView() {
    const el = currentLine();
    if (!el || !lyricsBox) return false;
    const box = lyricsBox.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.bottom > box.top && r.top < box.bottom;
  }
  // Your input, not ours: a scroll we started never calls this.
  function hold() {
    held = true;
    clearTimeout(idle);
    idle = setTimeout(() => (held = !inView()), 1500);
  }
  $effect(() => () => clearTimeout(idle));
  // A new song starts followed. The track on its own: every update is a new
  // player object, and following `p` would let each one end the hold.
  const track = $derived(p?.track);
  $effect(() => {
    void track;
    held = false;
  });
  $effect(() => {
    const el = currentLine();
    if (held || !el || !lyricsBox) return;
    lyricsBox.scrollTo({ top: el.offsetTop - lyricsBox.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  });
  // A line clicked: the player goes to where it starts, and the lyrics follow.
  function seek(ms: number) {
    if (!seekable) return;
    held = false;
    tell({ topic: "media", command: "SetPosition", player: p.player, track: p.track, position: Math.round(ms * 1000) });
  }

  const control = "grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-2 text-2xl text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,transparent)] disabled:cursor-default disabled:opacity-40";
</script>

<div class="ct-media flex h-full min-h-0 flex-col gap-4" bind:clientWidth={width}>
  {#if players.length}
    <div class="grid shrink-0 grid-cols-12 gap-2" role="group" aria-label="Players">
      {#each players as q, i (q.player)}
        <button
          type="button"
          class="col-span-(--span) flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 px-3 py-2 {q.player === p?.player
            ? 'bg-primary text-on-primary'
            : 'bg-surface-container-high/70 text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_18%,var(--caelestia-surface-container-high))]'}"
          style:--span={span[i]}
          aria-pressed={q.player === p?.player}
          onclick={() => choose(q)}
        >
          {#if q.status === "Playing"}<CtIcon name="play" />{/if}
          <span class="truncate">{q.identity}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if !p}
    <p class="m-0 px-1 text-on-surface-variant">{app.data.media ? "Nothing is playing." : "Waiting for the helper."}</p>
  {:else}
    <!-- Side by side, the lyrics fill the height and scroll; in one column,
         the whole tab scrolls and the lyrics get a box of their own. While
         another player slides in, both share one grid cell. -->
    <div class="grid grid-cols-[minmax(0,1fr)] overflow-x-clip {wide ? 'min-h-0 flex-1 grid-rows-[minmax(0,1fr)]' : ''}">
      {#key p.player}
        <div
          class="grid gap-4 [grid-area:1/1] {wide ? 'min-h-0 grid-cols-[var(--left)_minmax(0,1fr)]' : 'mx-auto w-full max-w-xl'}"
          style:--left="{settings.left}rem"
          in:fly={{ x: 48 * dir, duration: still ? 0 : 220, easing: cubicOut }}
          out:fly={{ x: -48 * dir, duration: still ? 0 : 220, easing: cubicOut }}
        >
          <!-- Side by side, a card around the cover and controls shows what the
               space beside the lyrics belongs to. -->
          <div
            class="grid min-w-0 grid-cols-[minmax(0,1fr)] justify-items-center gap-3 {wide
              ? 'box-border w-[calc(var(--cover)+3rem)] max-w-full place-self-center rounded-3xl bg-primary-container/60 p-6'
              : 'content-start'}"
            style:--cover="{settings.cover}rem"
          >
            <div
              class="aspect-square w-[min(var(--cover),100%)] rounded-2xl bg-surface-container-high bg-(image:--art) bg-cover bg-center"
              style:--art={p.art ? `url(${JSON.stringify(p.art)})` : "none"}
            ></div>
            <div class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-0.5 text-center">
              <div class="text-lg font-medium"><CtMarquee text={p.title ?? p.identity} /></div>
              {#if line}<div class="text-sm text-on-surface-variant"><CtMarquee text={line} /></div>{/if}
              {#if p.year}<div class="text-xs text-on-surface-variant tabular-nums">{p.year}</div>{/if}
            </div>
            <div class="flex items-center justify-center gap-2">
              <button type="button" class={control} title="Previous" disabled={!p.canPrevious} onclick={() => run("Previous")}><CtIcon name="previous" /></button>
              <button type="button" class="grid cursor-pointer place-items-center rounded-full border-0 bg-primary p-3 text-2xl text-on-primary" title={p.status === "Playing" ? "Pause" : "Play"} onclick={() => run("PlayPause")}>
                <CtIcon name={p.status === "Playing" ? "pause" : "play"} />
              </button>
              <button type="button" class={control} title="Next" disabled={!p.canNext} onclick={() => run("Next")}><CtIcon name="next" /></button>
            </div>
            {#if !wide}<hr class="m-0 h-px w-full border-0 bg-outline-variant" />{/if}
          </div>
          <!-- Wheel, touch, keys and the scrollbar are you; a scroll while held
               (momentum, a drag) keeps holding. The handlers only notice you
               scrolling; they don't make the box a control. -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            bind:this={lyricsBox}
            onwheel={hold}
            ontouchmove={hold}
            onkeydown={hold}
            onpointerdown={(e) => e.target === e.currentTarget && hold()}
            onscroll={() => held && hold()}
            class="ct-lyrics relative overflow-auto px-1 text-center leading-relaxed {wide ? 'min-h-0 text-base' : 'max-h-80 text-sm'}">
            {#if synced.length}
              {#each synced as l, i (i)}
                <button
                  type="button"
                  data-line={i}
                  class="block w-full border-0 bg-transparent py-0.5 text-center transition-colors {seekable ? 'cursor-pointer hover:text-on-surface' : 'cursor-default'} {i === current
                    ? 'font-medium text-primary'
                    : 'text-on-surface-variant'}"
                  title={seekable ? "Play from here" : undefined}
                  onclick={() => seek(l.ms)}>{l.text || "♪"}</button
                >
              {/each}
            {:else if plain}
              <!-- Without times there's no line to jump to: say so, rather than
                   leave clicks doing nothing. -->
              <p class="m-0 mb-3 text-xs text-on-surface-variant/70">Unsynced lyrics: no times to follow or jump to.</p>
              <p class="m-0 whitespace-pre-line text-on-surface-variant">{plain}</p>
            {:else}
              <p class="m-0 text-on-surface-variant">{settings.lyrics && found?.error ? "Couldn't reach the lyrics." : settings.lyrics && !found && !p.lyrics ? "Looking for lyrics…" : "No lyrics available."}</p>
            {/if}
          </div>
        </div>
      {/key}
    </div>
  {/if}
</div>
