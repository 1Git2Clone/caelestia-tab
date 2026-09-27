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
    section: "self-center my-auto",
    defaults: {
      hour12: true,
      leadingZero: false,
      seconds: false,
      timeSeparator: "|",
      timeSize: 5.5,
      weight: 300,
      date: true,
      dateStyle: "long",
      dateSeparator: "/",
      dateSize: 1.8,
      glass: true,
    },
    fields: [
      { key: "hour12", label: "12-hour clock", type: "checkbox" },
      { key: "leadingZero", label: "Leading zero on the hour", type: "checkbox", hint: "Always there on a 24-hour clock." },
      { key: "seconds", label: "Show seconds", type: "checkbox" },
      { key: "timeSeparator", label: "Time separator", type: "text", placeholder: "|" },
      { key: "timeSize", label: "Time size", type: "range", min: 2, max: 12, step: 0.25, unit: "rem" },
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
      { key: "dateSize", label: "Date size", type: "range", min: 0.75, max: 5, step: 0.05, unit: "rem" },
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
  const size = (rem: number) => `min(${rem}rem, ${rem * 1.3}vw)`;
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
  <div class="ct-time text-(length:--size) leading-tight" style:--size={size(settings.timeSize)}>
    {#if parts}
      {@render joined(parts.time, settings.timeSeparator)}{#if parts.suffix}<span class="ct-suffix ml-[0.2em] text-[0.4em]">{parts.suffix}</span>{/if}
    {:else}&nbsp;{/if}
  </div>
  {#if settings.date}
    <div class="ct-date text-(length:--size)" style:--size={size(settings.dateSize)}>
      {#if parts}{@render joined(parts.date, settings.dateSeparator)}{:else}&nbsp;{/if}
    </div>
  {/if}
</div>
