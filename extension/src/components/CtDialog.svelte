<!-- A modal dialog. It opens when it mounts; closing it (Escape, or a button
     calling onclose) is the parent's cue to unmount it. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, onclose, children, footer }: { title: string; onclose: () => void; children: Snippet; footer?: Snippet } = $props();
  let dialog: HTMLDialogElement;
  $effect(() => dialog.showModal());
</script>

<dialog
  bind:this={dialog}
  {onclose}
  class="ct-dialog box-border backdrop:bg-[color-mix(in_srgb,var(--caelestia-scrim)_45%,transparent)] max-h-[calc(100vh-3rem)] w-[min(60rem,calc(100vw-2rem))] overflow-auto rounded-3xl border-0 bg-surface-container px-10 pt-8 pb-5 text-on-surface"
>
  <h2 class="mt-0 mb-5 text-2xl font-normal">{title}</h2>
  {@render children()}
  {#if footer}<footer class="mt-6 flex justify-end gap-2">{@render footer()}</footer>{/if}
</dialog>
