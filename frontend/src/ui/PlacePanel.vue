<script setup lang="ts">
import { computed } from 'vue';
import { directionsUrls } from '../directions';
import { t } from '../i18n';
import { useMapStore } from '../state/map';

const store = useMapStore();
const emit = defineEmits<{ close: [] }>();
const links = computed(() => (store.detail ? directionsUrls(store.detail.lat, store.detail.lon) : null));
const attributes = computed(() => Object.entries(store.detail?.attributes ?? {}));
const hours = computed(() => Object.entries(store.detail?.opening_hours ?? {}));
const dateFormat = computed(() => new Intl.DateTimeFormat(store.locale, { day: 'numeric', month: 'short' }));

function label(value: unknown): string {
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return String(value);
}
</script>

<template>
  <aside v-if="store.detail" class="panel" data-testid="place-panel" aria-live="polite">
    <button class="close" :aria-label="t('close', store.locale)" @click="emit('close')">×</button>
    <p class="kind">{{ store.detail.category.name }}</p>
    <h2>{{ store.detail.name }}</h2>
    <p v-if="store.detail.summary" class="summary">{{ store.detail.summary }}</p>
    <p v-if="store.detail.description" class="description">{{ store.detail.description }}</p>

    <section v-if="store.detail.promotions.length" class="promos">
      <h3>{{ t('promotions', store.locale) }}</h3>
      <article v-for="promo in store.detail.promotions" :key="promo.id">
        <strong>{{ promo.title }}</strong>
        <p v-if="promo.body">{{ promo.body }}</p>
        <small>{{ t('promotionEnds', store.locale, { date: dateFormat.format(new Date(promo.ends_at)) }) }}</small>
      </article>
    </section>

    <section v-if="hours.length">
      <h3>{{ t('openingHours', store.locale) }}</h3>
      <dl>
        <template v-for="[day, value] in hours" :key="day">
          <dt>{{ day }}</dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
    </section>

    <section v-if="attributes.length">
      <h3>{{ t('details', store.locale) }}</h3>
      <dl>
        <template v-for="[key, value] in attributes" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ label(value) }}</dd>
        </template>
      </dl>
    </section>

    <div v-if="links" class="actions">
      <a :href="links.google" target="_blank" rel="noopener noreferrer" class="primary">{{ t('directions', store.locale) }} · Google Maps</a>
      <a :href="links.waze" target="_blank" rel="noopener noreferrer">Waze</a>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  position: fixed;
  z-index: 30;
  top: 124px;
  right: 12px;
  bottom: 12px;
  width: 360px;
  overflow: auto;
  box-sizing: border-box;
  padding: 20px;
  border-radius: 20px;
  background: var(--surface-strong);
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow);
  animation: slide 0.3s both;
}
.close {
  position: absolute;
  top: 12px;
  right: 14px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--ground);
  font-size: 20px;
  cursor: pointer;
}
.kind {
  margin: 0 0 4px;
  font: 600 12px var(--font-ui);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}
h2 {
  margin: 0 36px 8px 0;
  font: 800 26px/1.1 var(--font-display);
}
.summary {
  font-weight: 500;
}
h3 {
  margin: 18px 0 6px;
  font: 700 14px var(--font-display);
}
.promos article {
  margin-bottom: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--promo) 22%, white);
}
.promos p {
  margin: 4px 0;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 14px;
  margin: 0;
  font-variant-numeric: tabular-nums;
}
dt {
  color: var(--muted);
  text-transform: capitalize;
}
dd {
  margin: 0;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}
.actions a {
  padding: 11px 14px;
  border: 1px solid var(--secondary);
  border-radius: 12px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}
.actions a.primary {
  flex: 1;
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  text-align: center;
}
@keyframes slide {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
}
@media (max-width: 720px) {
  .panel {
    top: auto;
    left: 12px;
    right: 12px;
    bottom: 12px;
    width: auto;
    max-height: 55vh;
    animation-name: rise;
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .panel {
    animation: none;
  }
}
</style>
