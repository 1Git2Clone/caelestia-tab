// Class lists shared by the Ct* components' controls, so every button and
// input looks the same without a global stylesheet.
export const button =
  "cursor-pointer rounded-full border-0 bg-surface-container-highest px-4 py-2 text-on-surface hover:bg-[color-mix(in_srgb,var(--caelestia-primary)_16%,var(--caelestia-surface-container-highest))]";
export const primary = "cursor-pointer rounded-full border-0 bg-primary px-4 py-2 text-on-primary";
export const iconButton = "grid cursor-pointer place-items-center rounded-full border-0 bg-transparent p-2 text-current hover:bg-[color-mix(in_srgb,currentColor_15%,transparent)]";
export const input =
  "w-full min-w-0 box-border rounded-xl border border-solid border-outline-variant bg-surface-container-high px-3.5 py-2.5 text-on-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";
export const hint = "text-sm text-on-surface-variant";
