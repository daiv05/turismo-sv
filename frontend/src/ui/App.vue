<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Engine } from '../engine/engine';
import type { ZoomLevel } from '../engine/zoom';

const canvas = ref<HTMLCanvasElement | null>(null);
const level = ref<ZoomLevel>('country');
let engine: Engine | null = null;

onMounted(() => {
  if (!canvas.value) return;
  engine = new Engine(canvas.value, { tilesetUrl: '/tiles/dev/tileset.json' });
  engine.events.on('zoomLevelChanged', (e) => {
    level.value = e.level;
  });
  engine.start();
});

onBeforeUnmount(() => engine?.dispose());
</script>

<template>
  <canvas ref="canvas" class="viewer" />
  <div class="hud" data-testid="zoom-level">{{ level }}</div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
}
.viewer {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.hud {
  position: fixed;
  top: 16px;
  left: 16px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.8);
  color: #0f47af;
  font: 600 14px system-ui, sans-serif;
  backdrop-filter: blur(8px);
}
</style>
