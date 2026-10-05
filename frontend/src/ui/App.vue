<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ContentController } from '../engine/contentController';
import { Engine } from '../engine/engine';
import { t } from '../i18n';
import { getApi, useMapStore } from '../state/map';
import CategoryChips from './CategoryChips.vue';
import PlacePanel from './PlacePanel.vue';
import TopBar from './TopBar.vue';

const store = useMapStore();
const canvas = ref<HTMLCanvasElement | null>(null);
let engine: Engine | null = null;
let controller: ContentController | null = null;
let selectedFromMap = false;

onMounted(() => {
  if (!canvas.value) return;
  const version = new URLSearchParams(window.location.search).get('tileset') ?? 'dev';
  engine = new Engine(canvas.value, { tilesetUrl: `/tiles/${encodeURIComponent(version)}/tileset.json` });
  controller = new ContentController({
    api: getApi(),
    onPlaces: (places) => engine?.setPlaces(places),
    onError: () => {
      store.error = 'network';
    },
  });

  engine.events.on('zoomLevelChanged', (e) => {
    store.zoomLevel = e.level;
  });
  engine.events.on('viewChanged', (e) => void controller?.updateView(e.bounds, e.level));
  engine.events.on('placeSelected', ({ slug }) => {
    selectedFromMap = true;
    if (slug) void store.selectPlace(slug);
    else store.clearSelection();
  });
  engine.start();
  void store.loadConfig();
  if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine;
});

watch(
  () => store.query,
  (query) => void controller?.setFilters(query),
  { deep: true },
);

watch(
  () => store.locale,
  () => {
    if (store.selectedSlug) void store.selectPlace(store.selectedSlug);
  },
);

watch(
  () => store.selectedSlug,
  (slug) => {
    engine?.select(slug, { fly: !selectedFromMap });
    selectedFromMap = false;
  },
);

function close(): void {
  store.clearSelection();
}

onBeforeUnmount(() => engine?.dispose());
</script>

<template>
  <canvas ref="canvas" class="viewer" />
  <TopBar @pick="(slug) => void store.selectPlace(slug)" />
  <CategoryChips />
  <PlacePanel @close="close" />
  <div class="hud" data-testid="zoom-level">{{ store.zoomLevel }}</div>
  <p v-if="store.error === 'network'" class="toast" role="status">{{ t('errorNetwork', store.locale) }}</p>
  <p v-else-if="store.error === 'notFound'" class="toast" role="status">{{ t('errorNotFound', store.locale) }}</p>
  <footer class="attribution">{{ t('attribution', store.locale) }}</footer>
</template>

<style>
:root {
  --ground: #e8ebfa;
  --neutral: #f7f8fc;
  --secondary: #c7cdf0;
  --accent: #0f47af;
  --glass: #9eb6ff;
  --vegetation: #6fcb8f;
  --water: #a9c8ff;
  --promo: #f2b33d;
  --surface: rgb(255 255 255 / 0.82);
  --surface-strong: rgb(255 255 255 / 0.94);
  --muted: #5b6285;
  --shadow: 0 10px 30px rgb(15 71 175 / 0.14);
  --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --font-ui: 'Onest', system-ui, sans-serif;
}
html,
body,
#app {
  margin: 0;
  height: 100%;
  font-family: var(--font-ui);
  color: #151a33;
}
.viewer {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.hud {
  position: fixed;
  left: 12px;
  bottom: 36px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--accent);
  font: 600 13px var(--font-ui);
  backdrop-filter: blur(8px);
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 70px;
  transform: translateX(-50%);
  margin: 0;
  padding: 10px 16px;
  border-radius: 12px;
  background: #151a33;
  color: #fff;
  font-size: 14px;
  z-index: 40;
}
.attribution {
  position: fixed;
  left: 12px;
  bottom: 10px;
  font-size: 11px;
  color: var(--muted);
}
</style>
