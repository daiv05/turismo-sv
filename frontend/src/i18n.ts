import type { Locale } from './api/types';

export const STRINGS = {
  search: { es: 'Buscar sitios, categorías o promos', en: 'Search places, categories or deals' },
  directions: { es: 'Cómo llegar', en: 'Directions' },
  close: { es: 'Cerrar', en: 'Close' },
  openingHours: { es: 'Horario', en: 'Opening hours' },
  details: { es: 'Detalles', en: 'Details' },
  promotions: { es: 'Promociones', en: 'Deals' },
  promotionEnds: { es: 'Hasta {date}', en: 'Until {date}' },
  noResults: { es: 'Sin resultados', en: 'No results' },
  places: { es: 'Sitios', en: 'Places' },
  categories: { es: 'Categorías', en: 'Categories' },
  errorNetwork: { es: 'No pudimos conectar con el servidor. Mostramos lo último disponible.', en: 'We could not reach the server. Showing the latest available data.' },
  errorNotFound: { es: 'Ese sitio ya no está disponible.', en: 'That place is no longer available.' },
  language: { es: 'Idioma', en: 'Language' },
  zoomCountry: { es: 'País', en: 'Country' },
  zoomDepartment: { es: 'Departamento', en: 'Department' },
  zoomCity: { es: 'Ciudad', en: 'City' },
  zoomStreet: { es: 'Calle', en: 'Street' },
  viewList: { es: 'Vista lista', en: 'List view' },
  viewMap: { es: 'Vista mapa 3D', en: '3D map view' },
  listEmpty: { es: 'No hay sitios para mostrar con estos filtros.', en: 'No places match these filters.' },
  noWebgl: { es: 'Tu navegador no puede mostrar el mapa 3D, así que te mostramos la lista.', en: 'Your browser cannot show the 3D map, so here is the list.' },
  attribution: { es: 'Datos © OpenStreetMap, Copernicus', en: 'Data © OpenStreetMap, Copernicus' },
} as const satisfies Record<string, Record<Locale, string>>;

export type StringKey = keyof typeof STRINGS;

/**
 * Looks up a UI string and fills `{name}` placeholders from params. Placeholders without a value stay as written.
 */
export function t(key: StringKey, locale: Locale, params: Record<string, string> = {}): string {
  return STRINGS[key][locale].replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}
