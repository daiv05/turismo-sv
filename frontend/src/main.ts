import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './ui/App.vue';

createApp(App).use(createPinia()).mount('#app');

if ('serviceWorker' in navigator && (import.meta.env.PROD || window.location.search.includes('pwa=1'))) {
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}
