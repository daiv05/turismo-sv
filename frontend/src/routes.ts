export type Route = { kind: 'home' } | { kind: 'place'; slug: string } | { kind: 'zone'; slug: string };

const HOME: Route = { kind: 'home' };

/**
 * Reads the deep link of a URL path. Anything that is not exactly `/lugar/{slug}` or `/zona/{slug}` is home.
 */
export function parseRoute(pathname: string): Route {
  const match = /^\/(lugar|zona)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return HOME;
  try {
    const slug = decodeURIComponent(match[2]!);
    return match[1] === 'lugar' ? { kind: 'place', slug } : { kind: 'zone', slug };
  } catch {
    return HOME;
  }
}

export function pathFor(route: Route): string {
  if (route.kind === 'place') return `/lugar/${encodeURIComponent(route.slug)}`;
  if (route.kind === 'zone') return `/zona/${encodeURIComponent(route.slug)}`;
  return '/';
}
