export type Locale = 'es' | 'en';

export interface CategorySummary {
  slug: string;
  name: string;
  icon: string;
  color_token: string;
  kind: 'attraction' | 'service' | 'commerce';
}

export interface PromotionSummary {
  id: number;
  title: string;
  body: string | null;
  ends_at: string;
  sprite: PromotionSprite;
}

export interface PromotionSprite {
  type: 'static' | 'spritesheet' | 'template';
  url: string | null;
  frames: number;
  cols: number;
  rows: number;
  fps: number;
  template_key: string | null;
  template_data: Record<string, unknown> | null;
}

export interface PlaceSummary {
  id: number;
  slug: string;
  name: string;
  summary: string | null;
  lon: number;
  lat: number;
  priority: number;
  category: CategorySummary;
  model: { version: number; glb_url: string } | null;
  promotions: PromotionSummary[];
}

export interface PlaceDetail extends PlaceSummary {
  description: string | null;
  attributes: Record<string, unknown>;
  opening_hours: Record<string, string> | null;
}

export interface PlacesResponse {
  cell: string;
  data: PlaceSummary[];
}

export interface ConfigCategory {
  slug: string;
  name: Record<Locale, string>;
  icon: string;
  color_token: string;
  kind: string;
  min_zoom: number;
}

export interface ConfigZone {
  slug: string;
  name: Record<Locale, string>;
  type: string;
  camera: { lon: number; lat: number; distance: number } | null;
}

export interface AppConfig {
  tileset: { version: string; base_url: string } | null;
  palette: Record<string, string>;
  cell_sizes: number[];
  categories: ConfigCategory[];
  zones: ConfigZone[];
}

export interface ZoneDetail extends ConfigZone {
  children: ConfigZone[];
}

export interface SearchResponse {
  places: Array<{ slug: string; name: string; category: string }>;
  categories: Array<{ slug: string; name: string }>;
  promotions: Array<{ id: number; title: string; place_slug: string }>;
}
