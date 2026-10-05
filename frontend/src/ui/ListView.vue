<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { PlaceSummary } from '../api/types';
import { t } from '../i18n';
import { groupByCategory } from '../listModel';
import { getApi, useMapStore } from '../state/map';

const store = useMapStore();
const places = ref<PlaceSummary[]>([]);
const loading = ref(true);
let request = 0;

const groups = computed(() => groupByCategory(places.value, store.categories.map((c) => c.slug)));

async function load(): Promise<void> {
  const current = ++request;
  loading.value = true;
  try {
    const result = await getApi().list(store.query);
    if (current === request) places.value = result;
    store.error = null;
  } catch {
    if (current === request) store.error = 'network';
  } finally {
    if (current === request) loading.value = false;
  }
}

onMounted(load);
watch(() => store.query, load, { deep: true });
</script>

<template>
  <main class="list" data-testid="list-view">
    <p v-if="store.webglMissing" class="notice">{{ t('noWebgl', store.locale) }}</p>
    <p v-if="!loading && groups.length === 0" class="empty">{{ t('listEmpty', store.locale) }}</p>
    <section v-for="group in groups" :key="group.slug" :aria-labelledby="`group-${group.slug}`">
      <h2 :id="`group-${group.slug}`">{{ group.name }}</h2>
      <ul>
        <li v-for="place in group.places" :key="place.id">
          <a :href="`/lugar/${place.slug}`" :data-testid="`list-${place.slug}`" @click.prevent="store.selectPlace(place.slug)">
            <strong>{{ place.name }}</strong>
            <span v-if="place.summary">{{ place.summary }}</span>
            <em v-for="promo in place.promotions" :key="promo.id" class="promo">{{ promo.title }}</em>
          </a>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.list {
  box-sizing: border-box;
  min-height: 100%;
  padding: 132px 16px 48px;
  max-width: 760px;
  margin: 0 auto;
  background: transparent;
}
.notice {
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--surface);
  color: var(--muted);
}
.empty {
  color: var(--muted);
}
h2 {
  margin: 28px 0 8px;
  font: 800 20px var(--font-display);
  color: var(--accent);
}
ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
a {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--surface-strong);
  box-shadow: var(--shadow);
  color: inherit;
  text-decoration: none;
}
a:focus-visible,
a:hover {
  outline: 2px solid var(--accent);
}
span {
  color: var(--muted);
  font-size: 14px;
}
.promo {
  justify-self: start;
  margin-top: 4px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--promo);
  font: 600 12px var(--font-ui);
  font-style: normal;
}
</style>
