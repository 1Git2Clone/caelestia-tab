<script module lang="ts">
  import type { WidgetInfo } from "../../fields.ts";

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
  };
  const two = (n: number) => String(n).padStart(2, "0");

  // The clock's pieces for a moment: the time's parts, AM or PM, and the
  // date's parts, each joined with the user's separator when shown.
  export function clock(s: any, now: Date) {
    let h = now.getHours();
    let suffix = "";
    if (s.hour12) {
      suffix = h < 12 ? "AM" : "PM";
      h = h % 12 || 12;
    }
    const time = [s.leadingZero || !s.hour12 ? two(h) : String(h), two(now.getMinutes())];
    if (s.seconds) time.push(two(now.getSeconds()));
    const name = (o: Intl.DateTimeFormatOptions) => now.toLocaleDateString(undefined, o);
    const date = {
      long: [name({ weekday: "long" }), ordinal(now.getDate()), name({ month: "long" })],
      short: [name({ weekday: "short" }), String(now.getDate()), name({ month: "short" })],
      numeric: [two(now.getDate()), two(now.getMonth() + 1), String(now.getFullYear())],
      iso: [String(now.getFullYear()), two(now.getMonth() + 1), two(now.getDate())],
    }[s.dateStyle as "long"] ?? [];
    return { time, suffix, date };
  }

  export const widget: WidgetInfo = {
    label: "Clock and date",
    place: { justify: "center", align: "center" },
    defaults: {
      hour12: true,
      leadingZero: false,
      seconds: false,
      timeSeparator: "|",
      // Font sizes are in pt; `timeSize` and `dateSize` were rem and are left
      // alone rather than read as pt.
      timePt: 66,
      timeFont: "",
      weight: 300,
      date: true,
      dateStyle: "long",
      dateSeparator: "/",
      datePt: 22,
      dateFont: "",
      glass: true,
    },
    fields: [
      { key: "hour12", label: "12-hour clock", type: "checkbox" },
      { key: "leadingZero", label: "Leading zero on the hour", type: "checkbox", hint: "Always there on a 24-hour clock." },
      { key: "seconds", label: "Show seconds", type: "checkbox" },
      { key: "timeSeparator", label: "Time separator", type: "text", placeholder: "|" },
      { key: "timePt", label: "Time size", type: "range", min: 16, max: 160, unit: "pt" },
      { key: "timeFont", label: "Time font", type: "font", hint: "Empty uses the page's font." },
      { key: "weight", label: "Weight", type: "range", min: 100, max: 900, step: 100 },
      { key: "date", label: "Show the date", type: "checkbox" },
      {
        key: "dateStyle",
        label: "Date",
        type: "select",
        options: [
          ["long", "Sunday / 27th / September"],
          ["short", "Sun / 27 / Sep"],
          ["numeric", "27 / 09 / 2026"],
          ["iso", "2026 / 09 / 27"],
        ],
      },
      { key: "dateSeparator", label: "Date separator", type: "text", placeholder: "/" },
      { key: "datePt", label: "Date size", type: "range", min: 8, max: 72, unit: "pt" },
      { key: "dateFont", label: "Date font", type: "font", hint: "Empty uses the page's font." },
      { key: "glass", label: "On glass", type: "checkbox", hint: "Keeps it legible over a busy wallpaper." },
    ],
  };
</script>

<script lang="ts">
  let { settings }: { settings: any } = $props();

  // No time until mounted: a pre-rendered copy of the page can be hours old.
  let now: Date | null = $state(null);
  $effect(() => {
    now = new Date();
    const timer = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(timer);
  });
  const parts = $derived(now ? clock(settings, now) : null);
  // Shrinks with a narrow window instead of overflowing it.
  const size = (pt: number) => `min(${pt}pt, ${(pt * 0.18).toFixed(2)}vw)`;
</script>

{#snippet joined(list: string[], sep: string)}
  {#each list as part, i (i)}{#if i}<span class="ct-sep mx-[0.15em] text-primary">{sep}</span>{/if}{part}{/each}
{/snippet}

<div
  class="ct-clock font-(weight:--weight) text-center tabular-nums {settings.glass
    ? 'rounded-[1.75rem] bg-glass px-9 pt-2 pb-3.5 backdrop-blur-[10px] in-[.ct-edge-top]:rounded-t-none in-[.ct-edge-bottom]:rounded-b-none'
    : ''}"
  style:--weight={settings.weight}
>
  <div class="ct-time font-(family-name:--font) text-(length:--size) leading-tight" style:--size={size(settings.timePt)} style:--font={settings.timeFont ? `${settings.timeFont}, var(--ct-font)` : null}>
    {#if parts}
      {@render joined(parts.time, settings.timeSeparator)}{#if parts.suffix}<span class="ct-suffix ml-[0.2em] text-[0.4em]">{parts.suffix}</span>{/if}
    {:else}&nbsp;{/if}
  </div>
  {#if settings.date}
    <div class="ct-date font-(family-name:--font) text-(length:--size)" style:--size={size(settings.datePt)} style:--font={settings.dateFont ? `${settings.dateFont}, var(--ct-font)` : null}>
      {#if parts}{@render joined(parts.date, settings.dateSeparator)}{:else}&nbsp;{/if}
    </div>
  {/if}
</div>
