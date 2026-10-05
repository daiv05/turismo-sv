<?php

namespace App\Http\Controllers\Api;

use App\Domain\Zones\Zone;
use Illuminate\Http\JsonResponse;

final class ZoneController
{
    public function show(string $slug): JsonResponse
    {
        $zone = Zone::query()->with('children')->where('slug', $slug)->firstOrFail();
        $summary = fn (Zone $z) => [
            'slug' => $z->slug,
            'name' => $z->getTranslations('name'),
            'type' => $z->type->value,
            'camera' => $z->camera,
        ];

        return response()->json(['data' => $summary($zone) + ['children' => $zone->children->map($summary)->values()]]);
    }
}
