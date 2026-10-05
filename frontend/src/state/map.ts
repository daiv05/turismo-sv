import { defineStore } from 'pinia';
import { ApiClient, ApiError } from '../api/client';
import type { AppConfig, ConfigCategory, Locale, PlaceDetail, SearchResponse } from '../api/types';
import type { ZoomLevel } from '../engine/zoom';

let api = new ApiClient(import.meta.env?.VITE_API_URL ?? '');

/**
 * Replaces the API client, which tests use to inject a fake.
 */
export function setApi(client: ApiClient): void {
  api = client;
}

export function getApi(): ApiClient {
  return api;
}

export type ErrorKind = 'network' | 'notFound' | null;

export const useMapStore = defineStore('map', {
  state: () => ({
    locale: 'es' as Locale,
    categories: [] as ConfigCategory[],
    tileset: null as AppConfig['tileset'],
    activeCategories: [] as string[],
    selectedSlug: null as string | null,
    detail: null as PlaceDetail | null,
    zoomLevel: 'country' as ZoomLevel,
    results: null as SearchResponse | null,
    error: null as ErrorKind,
    detailRequest: 0,
    searchRequest: 0,
  }),
  getters: {
    query: (state) => ({ categories: [...state.activeCategories], locale: state.locale }),
  },
  actions: {
    async loadConfig(): Promise<void> {
      try {
        const config = await api.config();
        this.categories = config.categories;
        this.tileset = config.tileset;
        this.error = null;
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        this.error = 'network';
      }
    },

    async selectPlace(slug: string): Promise<void> {
      const request = ++this.detailRequest;
      this.selectedSlug = slug;
      try {
        const detail = await api.place(slug, this.locale, new AbortController().signal);
        if (request !== this.detailRequest) return;
        this.detail = detail;
        this.error = null;
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (request !== this.detailRequest) return;
        this.detail = null;
        this.error = error.status === 404 ? 'notFound' : 'network';
      }
    },

    clearSelection(): void {
      this.detailRequest++;
      this.selectedSlug = null;
      this.detail = null;
    },

    toggleCategory(slug: string): void {
      this.activeCategories = this.activeCategories.includes(slug)
        ? this.activeCategories.filter((s) => s !== slug)
        : [...this.activeCategories, slug];
    },

    async runSearch(q: string): Promise<void> {
      const request = ++this.searchRequest;
      if (q.trim().length < 2) {
        this.results = null;
        return;
      }
      try {
        const results = await api.search(q, this.locale);
        if (request === this.searchRequest) this.results = results;
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (request === this.searchRequest) this.error = 'network';
      }
    },
  },
});
