<?php

namespace App\Http\Controllers\Api;

use App\Domain\Places\Place;
use App\Http\Resources\PlaceResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Flat list of published places for the list view and for clients that cannot draw the map.
 */
final class PlaceListController
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'locale' => ['nullable', 'in:es,en'],
            'categories' => ['nullable', 'string', 'max:500'],
            'zone' => ['nullable', 'string', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:300'],
        ]);
        app()->setLocale($data['locale'] ?? 'es');
        $slugs = array_values(array_filter(array_map('trim', explode(',', $data['categories'] ?? ''))));

        $places = Place::query()
            ->withCoordinates()
            ->published()
            ->when($slugs, fn ($q) => $q->whereHas('category', fn ($c) => $c->whereIn('slug', $slugs)))
            ->when($data['zone'] ?? null, fn ($q, $zone) => $q->whereHas('zone', fn ($z) => $z->where('slug', $zone)))
            ->with(['category', 'currentModel', 'promotions' => fn ($q) => $q->active()->orderByDesc('priority')])
            ->orderByDesc('priority')
            ->orderBy('places.id')
            ->limit((int) ($data['limit'] ?? 200))
            ->get();

        return response()->json(['data' => PlaceResource::collection($places)->resolve()]);
    }
}
