<script setup lang="ts">
withDefaults(
  defineProps<{
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  { disabled: false, type: "button" },
);
</script>

<template>
  <button
    :disabled="disabled"
    :type="type"
    class="rounded-ev-control bg-ev-primary focus:ring-ev-primary min-h-11 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <slot />
  </button>
</template>
