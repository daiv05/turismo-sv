<?php

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Zones\Zone;

it('lists published places regardless of the zoom level of their category', function () {
    $fine = Category::factory()->create(['min_zoom' => 3, 'slug' => 'toilets']);
    Place::factory()->at(-89.19, 13.70)->create(['slug' => 'banos', 'category_id' => $fine->id]);
    Place::factory()->at(-89.56, 13.99)->create(['slug' => 'santa-ana']);
    Place::factory()->status(PlaceStatus::Draft)->create(['slug' => 'oculto']);

    $slugs = collect($this->getJson('/api/list')->assertOk()->json('data'))->pluck('slug')->sort()->values()->all();

    expect($slugs)->toBe(['banos', 'santa-ana']);
});

it('filters by category and zone and orders by priority', function () {
    $zone = Zone::factory()->create(['slug' => 'centro']);
    $museums = Category::factory()->create(['slug' => 'museums']);
    Place::factory()->create(['slug' => 'a', 'zone_id' => $zone->id, 'category_id' => $museums->id, 'priority' => 1]);
    Place::factory()->create(['slug' => 'b', 'zone_id' => $zone->id, 'category_id' => $museums->id, 'priority' => 9]);
    Place::factory()->create(['slug' => 'c', 'zone_id' => $zone->id]);
    Place::factory()->create(['slug' => 'd', 'category_id' => $museums->id]);

    $slugs = collect($this->getJson('/api/list?zone=centro&categories=museums')->json('data'))->pluck('slug')->all();

    expect($slugs)->toBe(['b', 'a']);
});

it('translates and caps the result', function () {
    Place::factory()->count(3)->create(['name' => ['es' => 'Hola', 'en' => 'Hello']]);

    $data = $this->getJson('/api/list?locale=en&limit=2')->json('data');

    expect($data)->toHaveCount(2)->and($data[0]['name'])->toBe('Hello');
});

it('validates its parameters', function () {
    $this->getJson('/api/list?locale=fr')->assertStatus(422);
    $this->getJson('/api/list?limit=0')->assertStatus(422);
    $this->getJson('/api/list?limit=1000')->assertStatus(422);
});

it('only embeds active promotions', function () {
    $place = Place::factory()->create();
    App\Domain\Promotions\Promotion::create(['place_id' => $place->id, 'title' => ['es' => 'Vencida'], 'starts_at' => now()->subDays(3), 'ends_at' => now()->subDay(), 'status' => PlaceStatus::Published, 'sprite_type' => 'template', 'template_key' => 'new']);
    App\Domain\Promotions\Promotion::create(['place_id' => $place->id, 'title' => ['es' => 'Vigente'], 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(), 'status' => PlaceStatus::Published, 'sprite_type' => 'template', 'template_key' => 'new']);

    expect(collect($this->getJson('/api/list')->json('data.0.promotions'))->pluck('title')->all())->toBe(['Vigente']);
});
