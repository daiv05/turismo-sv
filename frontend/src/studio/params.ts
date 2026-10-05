export interface StudioParams {
  glb: string;
}

/**
 * Reads the model to preview from the query string. Only http(s) URLs or same origin paths ending in `.glb` are
 * accepted, so the page cannot be turned into a way to load arbitrary schemes.
 */
export function parseStudioParams(search: string): StudioParams | null {
  const value = new URLSearchParams(search).get('glb');
  if (!value || !/\.glb(\?.*)?$/i.test(value)) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return { glb: value };
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? { glb: url.toString() } : null;
  } catch {
    return null;
  }
}
