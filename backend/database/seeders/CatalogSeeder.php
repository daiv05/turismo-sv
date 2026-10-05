<?php

namespace Database\Seeders;

use App\Domain\Categories\Category;
use App\Domain\Categories\CategoryKind;
use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['monuments', 'Monumentos', 'Monuments', 'landmark', 'accent', CategoryKind::Attraction, 0, null],
            ['museums', 'Museos', 'Museums', 'museum', 'accent', CategoryKind::Attraction, 1, null],
            ['parks', 'Parques', 'Parks', 'tree', 'vegetation', CategoryKind::Attraction, 1, null],
            ['restaurants', 'Restaurantes', 'Restaurants', 'utensils', 'promo', CategoryKind::Commerce, 2, [
                'type' => 'object',
                'properties' => ['cuisine' => ['type' => 'string', 'maxLength' => 60], 'price_level' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 4]],
                'additionalProperties' => false,
            ]],
            ['toilets', 'Baños públicos', 'Public toilets', 'toilet', 'glass', CategoryKind::Service, 3, [
                'type' => 'object',
                'properties' => ['accessible' => ['type' => 'boolean'], 'fee' => ['type' => 'number', 'minimum' => 0]],
                'required' => ['accessible'],
                'additionalProperties' => false,
            ]],
        ];

        foreach ($categories as $i => [$slug, $es, $en, $icon, $color, $kind, $minZoom, $schema]) {
            Category::updateOrCreate(['slug' => $slug], [
                'name' => ['es' => $es, 'en' => $en],
                'icon' => $icon,
                'color_token' => $color,
                'kind' => $kind,
                'min_zoom' => $minZoom,
                'attributes_schema' => $schema,
                'sort' => $i,
            ]);
        }
    }
}
