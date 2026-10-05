import type { PlaceSummary } from './api/types';

export interface PlaceGroup {
  slug: string;
  name: string;
  places: PlaceSummary[];
}

/**
 * Groups places by category for the list view. Categories follow the order given (the admin's sort), unknown ones
 * come last alphabetically, and places are ordered by priority and then by name.
 */
export function groupByCategory(places: readonly PlaceSummary[], order: readonly string[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const place of places) {
    const group = groups.get(place.category.slug) ?? { slug: place.category.slug, name: place.category.name, places: [] };
    group.places.push(place);
    groups.set(place.category.slug, group);
  }
  const rank = (slug: string): number => {
    const index = order.indexOf(slug);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...groups.values()]
    .map((g) => ({ ...g, places: [...g.places].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name)) }))
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
}
