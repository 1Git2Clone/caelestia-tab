<!-- A form drawn from a widget's fields (fields.ts), bound to `values`: every
     change lands in `values` as it's made. -->
<script lang="ts">
  import type { Field } from "../fields.ts";
  import CtField from "./CtField.svelte";

  let { fields, values }: { fields: Field[]; values: Record<string, any> } = $props();
</script>

<div class="ct-form grid gap-4">
  {#each fields as field, i (i)}
    {#if !field.when || field.when(values)}<CtField {field} {values} />{/if}
  {/each}
</div>
