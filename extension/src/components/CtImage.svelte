<!-- An image by URL, or uploaded. Uploads are scaled down to what a tile
     shows, so they don't weigh down every open tab and the saved settings. -->
<script lang="ts">
  import { button, hint as hintClass, iconButton, input } from "../ui.ts";
  import CtIcon from "./CtIcon.svelte";

  let { label, hint, value = $bindable("") }: { label: string; hint?: string; value: string } = $props();
  let file: HTMLInputElement;
  const uploaded = $derived(value?.startsWith("data:"));

  // ponytail: 512px WebP; an animated GIF keeps only its first frame.
  async function upload() {
    const f = file.files?.[0];
    if (!f) return;
    const bitmap = await createImageBitmap(f);
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
    value = await new Promise<string>((done) => {
      const reader = new FileReader();
      reader.onload = () => done(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
</script>

<div class="grid gap-1.5">
  <span>{label}</span>
  <div class="flex items-center gap-2">
    {#if uploaded}
      <em class="flex-1">Uploaded image</em>
    {:else}
      <input type="url" class={input} placeholder="https://example.com/image.jpg" bind:value />
    {/if}
    <button type="button" class={button} onclick={() => file.click()}>Upload</button>
    {#if value}
      <button type="button" class={iconButton} title="Remove the image" onclick={() => (value = "")}><CtIcon name="close" /></button>
    {/if}
    <input type="file" accept="image/*" hidden bind:this={file} onchange={upload} />
  </div>
  {#if hint}<small class={hintClass}>{hint}</small>{/if}
</div>
