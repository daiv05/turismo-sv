<?php

namespace App\Http\Controllers\Api;

use App\Domain\Categories\Category;
use App\Domain\Tilesets\TilesetVersion;
use App\Domain\Zones\Zone;
use Illuminate\Http\JsonResponse;

final class ConfigController
{
    public function __invoke(): JsonResponse
    {
        $tileset = TilesetVersion::current();

        return response()->json([
            'tileset' => $tileset ? ['version' => $tileset->version, 'base_url' => $tileset->base_url] : null,
            'palette' => config('palette'),
            'cell_sizes' => config('cells.sizes'),
            'categories' => Category::query()->orderBy('sort')->orderBy('id')->get()->map(fn (Category $c) => [
                'slug' => $c->slug,
                'name' => $c->getTranslations('name'),
                'icon' => $c->icon,
                'color_token' => $c->color_token,
                'kind' => $c->kind->value,
                'min_zoom' => $c->min_zoom,
            ])->values(),
            'zones' => Zone::query()->whereNull('parent_id')->orderBy('id')->get()->map(fn (Zone $z) => [
                'slug' => $z->slug,
                'name' => $z->getTranslations('name'),
                'type' => $z->type->value,
                'camera' => $z->camera,
            ])->values(),
        ]);
    }
}
