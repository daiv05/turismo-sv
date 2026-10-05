import { describe, expect, it, vi } from 'vitest';
import type { PlaceSummary, PlacesResponse } from '../src/api/types';
import { ContentController } from '../src/engine/contentController';
import { cellSize } from '../src/engine/cells';

const place = (id: number, slug: string): PlaceSummary => ({
  id,
  slug,
  name: slug,
  summary: null,
  lon: -89.19,
  lat: 13.7,
  priority: 0,
  category: { slug: 'monuments', name: 'Monuments', icon: 'landmark', color_token: 'accent', kind: 'attraction' },
  model: null,
  promotions: [],
});

function setup(responses: Record<string, PlaceSummary[] | Error>) {
  const places = vi.fn(async (cell: { z: number; x: number; y: number }, _query?: unknown): Promise<PlacesResponse> => {
    const key = `${cell.z}/${cell.x}/${cell.y}`;
    const r = responses[key];
    if (r instanceof Error) throw r;
    return { cell: key, data: r ?? [] };
  });
  const onPlaces = vi.fn();
  const onError = vi.fn();
  const controller = new ContentController({ api: { places }, onPlaces, onError });
  return { places, onPlaces, onError, controller };
}

const size = cellSize('city');
const oneCell = { minX: 10, maxX: size - 10, minZ: 10, maxZ: size - 10 };

describe('ContentController', () => {
  it('requests the visible cells and publishes their places', async () => {
    const { places, onPlaces, controller } = setup({ '2/0/0': [place(1, 'a'), place(2, 'b')] });

    await controller.updateView(oneCell, 'city');

    expect(places).toHaveBeenCalledTimes(1);
    expect(onPlaces).toHaveBeenLastCalledWith([place(1, 'a'), place(2, 'b')]);
  });

  it('does not refetch or republish when the visible cells are unchanged', async () => {
    const { places, onPlaces, controller } = setup({ '2/0/0': [place(1, 'a')] });

    await controller.updateView(oneCell, 'city');
    await controller.updateView({ ...oneCell, minX: 20 }, 'city');

    expect(places).toHaveBeenCalledTimes(1);
    expect(onPlaces).toHaveBeenCalledTimes(1);
  });

  it('merges places from several cells without duplicates', async () => {
    const { onPlaces, controller } = setup({ '2/0/0': [place(1, 'a')], '2/1/0': [place(1, 'a'), place(2, 'b')] });

    await controller.updateView({ minX: 10, maxX: size + 10, minZ: 10, maxZ: 20 }, 'city');

    expect(onPlaces.mock.lastCall![0].map((p: PlaceSummary) => p.slug).sort()).toEqual(['a', 'b']);
  });

  it('keeps showing the cells that loaded when another fails, and reports the error once', async () => {
    const { onPlaces, onError, controller } = setup({ '2/0/0': [place(1, 'a')], '2/1/0': new Error('boom') });

    await controller.updateView({ minX: 10, maxX: size + 10, minZ: 10, maxZ: 20 }, 'city');

    expect(onPlaces.mock.lastCall![0]).toHaveLength(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reloads everything when the filters change', async () => {
    const { places, controller } = setup({ '2/0/0': [place(1, 'a')] });
    await controller.updateView(oneCell, 'city');

    await controller.setFilters({ categories: ['museums'], locale: 'es' });

    expect(places).toHaveBeenCalledTimes(2);
  });

  it('ignores a filter change before the first view', async () => {
    const { places, controller } = setup({});

    await controller.setFilters({ categories: ['museums'], locale: 'en' });

    expect(places).not.toHaveBeenCalled();
  });

  it('passes the current filters to the API', async () => {
    const { places, controller } = setup({});
    await controller.setFilters({ categories: ['parks'], locale: 'en' });

    await controller.updateView(oneCell, 'city');

    expect(places.mock.calls[0]![1]).toEqual({ categories: ['parks'], locale: 'en' });
  });

  it('clamps huge views to the world so it never floods the API', async () => {
    const { places, controller } = setup({});

    await controller.updateView({ minX: -5e7, maxX: 5e7, minZ: -5e7, maxZ: 5e7 }, 'street');

    expect(places.mock.calls.length).toBeLessThanOrEqual(400);
    expect(places.mock.calls.length).toBeGreaterThan(0);
  });

  it('drops stale answers when the view changed while loading', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const places = vi.fn(async (cell: { z: number; x: number; y: number }): Promise<PlacesResponse> => {
      if (cell.x === 0) await gate;
      return { cell: 'x', data: [place(cell.x + 1, `p${cell.x}`)] };
    });
    const onPlaces = vi.fn();
    const controller = new ContentController({ api: { places }, onPlaces, onError: vi.fn() });

    const slow = controller.updateView(oneCell, 'city');
    await controller.updateView({ minX: size + 10, maxX: size + 20, minZ: 10, maxZ: 20 }, 'city');
    release();
    await slow;

    expect(onPlaces).toHaveBeenCalledTimes(1);
    expect(onPlaces.mock.lastCall![0][0].slug).toBe('p1');
  });
});
