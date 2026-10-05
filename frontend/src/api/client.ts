import type { CellId } from '../engine/cells';
import type { AppConfig, Locale, PlaceDetail, PlaceSummary, PlacesResponse, SearchResponse, ZoneDetail } from './types';

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface PlacesQuery {
  categories: readonly string[];
  locale: Locale;
}

/**
 * Typed client for the public read only API. Network and HTTP failures surface as ApiError so callers
 * can tell them apart from programming errors.
 */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: Fetcher = (input, init) => fetch(input, init),
  ) {}

  config(signal?: AbortSignal): Promise<AppConfig> {
    return this.get<AppConfig>('/api/config', {}, signal);
  }

  places(cell: CellId, query: PlacesQuery, signal?: AbortSignal): Promise<PlacesResponse> {
    const params: Record<string, string> = { cell: `${cell.z}/${cell.x}/${cell.y}`, locale: query.locale };
    if (query.categories.length > 0) params.categories = query.categories.join(',');
    return this.get<PlacesResponse>('/api/places', params, signal);
  }

  async list(query: PlacesQuery, signal?: AbortSignal): Promise<PlaceSummary[]> {
    const params: Record<string, string> = { locale: query.locale };
    if (query.categories.length > 0) params.categories = query.categories.join(',');
    return (await this.get<{ data: PlaceSummary[] }>('/api/list', params, signal)).data;
  }

  async place(slug: string, locale: Locale, signal?: AbortSignal): Promise<PlaceDetail> {
    return (await this.get<{ data: PlaceDetail }>(`/api/places/${encodeURIComponent(slug)}`, { locale }, signal)).data;
  }

  async zone(slug: string, signal?: AbortSignal): Promise<ZoneDetail> {
    return (await this.get<{ data: ZoneDetail }>(`/api/zones/${encodeURIComponent(slug)}`, {}, signal)).data;
  }

  /**
   * @throws {RangeError} When the query is shorter than two characters, which the server would reject anyway.
   */
  search(q: string, locale: Locale, signal?: AbortSignal): Promise<SearchResponse> {
    if (q.trim().length < 2) {
      return Promise.reject(new RangeError('Search needs at least two characters'));
    }
    return this.get<SearchResponse>('/api/search', { q: q.trim(), locale }, signal);
  }

  private async get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`;
    let response: Response;
    try {
      response = await this.fetcher(url, { headers: { Accept: 'application/json' }, ...(signal ? { signal } : {}) });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(`Network error requesting ${path}`, null);
    }
    if (!response.ok) {
      throw new ApiError(`Request to ${path} failed with status ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  }
}
