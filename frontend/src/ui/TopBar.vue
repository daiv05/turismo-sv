<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../i18n';
import { useMapStore } from '../state/map';

const store = useMapStore();
const emit = defineEmits<{ pick: [slug: string] }>();
const text = ref('');
let timer = 0;

watch(text, (value) => {
  clearTimeout(timer);
  timer = window.setTimeout(() => void store.runSearch(value), 250);
});

const hasResults = computed(() => {
  const r = store.results;
  return !!r && r.places.length + r.categories.length + r.promotions.length > 0;
});

function pick(slug: string): void {
  emit('pick', slug);
  text.value = '';
  store.results = null;
}

function toggleCategoryFromSearch(slug: string): void {
  store.toggleCategory(slug);
  text.value = '';
  store.results = null;
}
</script>

<template>
  <header class="bar">
    <div class="brand">Turismo<span>SV</span></div>
    <div class="search">
      <input
        v-model="text"
        type="search"
        :placeholder="t('search', store.locale)"
        :aria-label="t('search', store.locale)"
        autocomplete="off"
        data-testid="search"
      />
      <div v-if="text.trim().length >= 2 && store.results" class="results" role="listbox" data-testid="search-results">
        <p v-if="!hasResults" class="empty">{{ t('noResults', store.locale) }}</p>
        <template v-else>
          <section v-if="store.results.places.length">
            <h3>{{ t('places', store.locale) }}</h3>
            <button v-for="p in store.results.places" :key="p.slug" role="option" @click="pick(p.slug)">{{ p.name }}</button>
          </section>
          <section v-if="store.results.categories.length">
            <h3>{{ t('categories', store.locale) }}</h3>
            <button v-for="c in store.results.categories" :key="c.slug" role="option" @click="toggleCategoryFromSearch(c.slug)">{{ c.name }}</button>
          </section>
          <section v-if="store.results.promotions.length">
            <h3>{{ t('promotions', store.locale) }}</h3>
            <button v-for="p in store.results.promotions" :key="p.id" role="option" @click="pick(p.place_slug)">{{ p.title }}</button>
          </section>
        </template>
      </div>
    </div>
    <div class="locale" role="group" :aria-label="t('language', store.locale)">
      <button :class="{ on: store.locale === 'es' }" @click="store.locale = 'es'">ES</button>
      <button :class="{ on: store.locale === 'en' }" @click="store.locale = 'en'">EN</button>
    </div>
  </header>
</template>

<style scoped>
.bar {
  position: fixed;
  inset: 12px 12px auto 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  border-radius: 18px;
  background: var(--surface);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
  z-index: 20;
}
.brand {
  font: 800 20px/1 var(--font-display);
  color: var(--accent);
  white-space: nowrap;
}
.brand span {
  color: var(--promo);
}
.search {
  position: relative;
  flex: 1;
  min-width: 0;
}
input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--secondary);
  border-radius: 12px;
  background: #fff;
  font: 400 15px var(--font-ui);
}
input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.results {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 60vh;
  overflow: auto;
  padding: 8px;
  border-radius: 14px;
  background: #fff;
  box-shadow: var(--shadow);
}
.results h3 {
  margin: 8px 8px 4px;
  font: 600 12px var(--font-ui);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.results button {
  display: block;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 10px;
  background: none;
  text-align: left;
  font: 400 15px var(--font-ui);
  cursor: pointer;
}
.results button:hover,
.results button:focus-visible {
  background: var(--ground);
}
.empty {
  margin: 10px;
  color: var(--muted);
}
.locale {
  display: flex;
  gap: 4px;
}
.locale button {
  padding: 7px 10px;
  border: 1px solid var(--secondary);
  border-radius: 10px;
  background: #fff;
  font: 600 13px var(--font-ui);
  cursor: pointer;
}
.locale button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
@media (max-width: 560px) {
  .brand {
    display: none;
  }
}
</style>
