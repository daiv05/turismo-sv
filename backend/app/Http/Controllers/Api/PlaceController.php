<?php

namespace App\Http\Controllers\Api;

use App\Domain\Places\Place;
use App\Http\Requests\PlacesIndexRequest;
use App\Http\Resources\PlaceResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlaceController
{
    public function index(PlacesIndexRequest $request): JsonResponse
    {
        app()->setLocale($request->validated('locale') ?? 'es');
        $cell = $request->cell();
        [$sql, $bindings] = $cell->sqlWithin('places.location');

        $places = Place::query()
            ->withCoordinates()
            ->published()
            ->whereRaw($sql, $bindings)
            ->whereHas('category', function ($q) use ($cell, $request) {
                $q->where('min_zoom', '<=', $cell->z);
                if ($slugs = $request->categorySlugs()) {
                    $q->whereIn('slug', $slugs);
                }
            })
            ->with(['category', 'currentModel', 'promotions' => fn ($q) => $q->active()->orderByDesc('priority')])
            ->orderByDesc('priority')
            ->orderBy('places.id')
            ->get();

        return response()->json([
            'cell' => $cell->key(),
            'data' => PlaceResource::collection($places)->resolve(),
        ]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $locale = $request->query('locale', 'es');
        abort_unless(in_array($locale, ['es', 'en'], true), 422, 'Unknown locale');
        app()->setLocale($locale);

        $place = Place::query()
            ->withCoordinates()
            ->published()
            ->where('places.slug', $slug)
            ->with(['category', 'currentModel', 'promotions' => fn ($q) => $q->active()->orderByDesc('priority')])
            ->firstOrFail();

        return response()->json(['data' => (new PlaceResource($place, detailed: true))->resolve()]);
    }
}
