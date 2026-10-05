import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../src/api/client';

function response(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { 'content-type': 'application/json', ...init.headers } });
}

describe('ApiClient', () => {
  it('requests places for a cell with filters and locale', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ cell: '2/-4/0', data: [] }));
    const client = new ApiClient('https://api.test', fetcher);

    await client.places({ z: 2, x: -4, y: 0 }, { categories: ['museums', 'parks'], locale: 'en' });

    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://api.test/api/places');
    expect(url.searchParams.get('cell')).toBe('2/-4/0');
    expect(url.searchParams.get('categories')).toBe('museums,parks');
    expect(url.searchParams.get('locale')).toBe('en');
  });

  it('omits empty filters', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ cell: '0/0/0', data: [] }));
    await new ApiClient('', fetcher).places({ z: 0, x: 0, y: 0 }, { categories: [], locale: 'es' });

    expect(fetcher.mock.calls[0]![0]).not.toContain('categories');
  });

  it('returns parsed data', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ cell: '2/0/0', data: [{ slug: 'a' }] }));
    const result = await new ApiClient('', fetcher).places({ z: 2, x: 0, y: 0 }, { categories: [], locale: 'es' });

    expect(result.data).toEqual([{ slug: 'a' }]);
  });

  it('encodes slugs in the detail URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ data: { slug: 'a b' } }));
    await new ApiClient('', fetcher).place('a b/c', 'es');

    expect(fetcher.mock.calls[0]![0]).toContain('/api/places/a%20b%2Fc');
  });

  it('turns HTTP errors into ApiError with the status', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ message: 'nope' }, { status: 404 }));

    await expect(new ApiClient('', fetcher).place('x', 'es')).rejects.toMatchObject({ name: 'ApiError', status: 404 });
  });

  it('turns network failures into ApiError without a status', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await new ApiClient('', fetcher).config().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBeNull();
  });

  it('passes an abort signal through', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ places: [], categories: [], promotions: [] }));
    const controller = new AbortController();
    await new ApiClient('', fetcher).search('cat', 'es', controller.signal);

    expect((fetcher.mock.calls[0]![1] as RequestInit).signal).toBe(controller.signal);
  });

  it('rejects searches shorter than two characters before calling the network', async () => {
    const fetcher = vi.fn();

    await expect(new ApiClient('', fetcher).search('a', 'es')).rejects.toBeInstanceOf(RangeError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
