<script setup lang="ts">
import { useMapStore } from '../state/map';

const store = useMapStore();
</script>

<template>
  <nav class="chips" aria-label="Filters">
    <button
      v-for="category in store.categories"
      :key="category.slug"
      :class="{ on: store.activeCategories.includes(category.slug) }"
      :aria-pressed="store.activeCategories.includes(category.slug)"
      :data-testid="`chip-${category.slug}`"
      @click="store.toggleCategory(category.slug)"
    >
      {{ category.name[store.locale] ?? category.name.es }}
    </button>
  </nav>
</template>

<style scoped>
.chips {
  position: fixed;
  top: 76px;
  left: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px;
  z-index: 15;
}
button {
  flex: none;
  padding: 8px 14px;
  border: 1px solid var(--secondary);
  border-radius: 999px;
  background: var(--surface);
  backdrop-filter: blur(10px);
  font: 500 14px var(--font-ui);
  cursor: pointer;
  animation: pop 0.35s both;
}
button:nth-child(2) {
  animation-delay: 0.05s;
}
button:nth-child(3) {
  animation-delay: 0.1s;
}
button:nth-child(4) {
  animation-delay: 0.15s;
}
button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
}
@media (prefers-reduced-motion: reduce) {
  button {
    animation: none;
  }
}
</style>
