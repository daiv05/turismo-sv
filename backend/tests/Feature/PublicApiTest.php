<?php

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Promotions\Promotion;
use App\Domain\Tilesets\TilesetVersion;
use App\Domain\Zones\Zone;

it('returns the full detail of a published place by slug', function () {
    Place::factory()->at(-89.191, 13.699)->create([
        'slug' => 'catedral',
        'description' => ['es' => 'Descripción larga', 'en' => 'Long description'],
        'attributes' => ['wheelchair' => true],
        'opening_hours' => ['mon' => ['09:00', '17:00']],
    ]);

    $this->getJson('/api/places/catedral?locale=en')
        ->assertOk()
        ->assertJsonPath('data.slug', 'catedral')
        ->assertJsonPath('data.description', 'Long description')
        ->assertJsonPath('data.attributes.wheelchair', true)
        ->assertJsonPath('data.opening_hours.mon', ['09:00', '17:00']);
});

it('does not reveal unpublished places', function () {
    Place::factory()->status(PlaceStatus::Draft)->create(['slug' => 'secreto']);

    $this->getJson('/api/places/secreto')->assertNotFound();
    $this->getJson('/api/places/no-existe')->assertNotFound();
});

it('serves config with tileset, palette, categories and top level zones', function () {
    TilesetVersion::create(['version' => 'v1', 'base_url' => 'https://cdn.test/tiles/v1/', 'is_current' => true, 'built_at' => now()]);
    TilesetVersion::create(['version' => 'v0', 'base_url' => 'https://cdn.test/tiles/v0/', 'is_current' => false, 'built_at' => now()->subDay()]);
    Category::factory()->create(['slug' => 'museums', 'sort' => 1]);
    $root = Zone::factory()->create(['slug' => 'el-salvador', 'parent_id' => null]);
    Zone::factory()->create(['slug' => 'san-salvador', 'parent_id' => $root->id]);

    $json = $this->getJson('/api/config')->assertOk()->json();

    expect($json['tileset'])->toBe(['version' => 'v1', 'base_url' => 'https://cdn.test/tiles/v1/'])
        ->and($json['palette']['accent'])->toBe('#0F47AF')
        ->and(collect($json['categories'])->pluck('slug')->all())->toBe(['museums'])
        ->and(collect($json['zones'])->pluck('slug')->all())->toBe(['el-salvador']);
});

it('serves config without a tileset when none is current', function () {
    $this->getJson('/api/config')->assertOk()->assertJsonPath('tileset', null);
});

it('serves a zone with its camera and children', function () {
    $parent = Zone::factory()->create(['slug' => 'san-salvador', 'camera' => ['lon' => -89.2, 'lat' => 13.7, 'distance' => 9000]]);
    Zone::factory()->create(['slug' => 'centro-historico', 'parent_id' => $parent->id]);

    $this->getJson('/api/zones/san-salvador')
        ->assertOk()
        ->assertJsonPath('data.camera.distance', 9000)
        ->assertJsonPath('data.children.0.slug', 'centro-historico');
    $this->getJson('/api/zones/nada')->assertNotFound();
});

it('searches places, categories and active promotions by name', function () {
    $place = Place::factory()->create(['name' => ['es' => 'Catedral Metropolitana', 'en' => 'Metropolitan Cathedral'], 'slug' => 'catedral']);
    Place::factory()->create(['name' => ['es' => 'Teatro Nacional'], 'slug' => 'teatro']);
    Place::factory()->status(PlaceStatus::Draft)->create(['name' => ['es' => 'Catedral oculta']]);
    Category::factory()->create(['name' => ['es' => 'Catedrales', 'en' => 'Cathedrals'], 'slug' => 'catedrales']);
    Promotion::create([
        'place_id' => $place->id, 'title' => ['es' => 'Visita guiada catedral'], 'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(), 'status' => PlaceStatus::Published, 'sprite_type' => 'template', 'template_key' => 'new',
    ]);
    Promotion::create([
        'place_id' => $place->id, 'title' => ['es' => 'Catedral vencida'], 'starts_at' => now()->subDays(3),
        'ends_at' => now()->subDay(), 'status' => PlaceStatus::Published, 'sprite_type' => 'template', 'template_key' => 'new',
    ]);

    $json = $this->getJson('/api/search?q=catedral&locale=es')->assertOk()->json();

    expect(collect($json['places'])->pluck('slug')->all())->toBe(['catedral'])
        ->and(collect($json['categories'])->pluck('slug')->all())->toBe(['catedrales'])
        ->and(collect($json['promotions'])->pluck('title')->all())->toBe(['Visita guiada catedral'])
        ->and($json['promotions'][0]['place_slug'])->toBe('catedral');
});

it('searches in the requested locale', function () {
    Place::factory()->create(['name' => ['es' => 'Catedral', 'en' => 'Cathedral'], 'slug' => 'catedral']);

    expect($this->getJson('/api/search?q=cathe&locale=en')->json('places'))->toHaveCount(1)
        ->and($this->getJson('/api/search?q=cathe&locale=es')->json('places'))->toHaveCount(0);
});

it('treats wildcard characters in the query literally', function () {
    Place::factory()->create(['name' => ['es' => 'Plaza Libertad']]);

    expect($this->getJson('/api/search?q=%25%25')->json('places'))->toHaveCount(0);
});

it('rejects empty or too short queries', function () {
    $this->getJson('/api/search')->assertStatus(422);
    $this->getJson('/api/search?q=a')->assertStatus(422);
});

it('rate limits public endpoints per client and tells them when to retry', function () {
    config(['api.rate_limit' => 3]);

    foreach (range(1, 3) as $i) {
        $this->getJson('/api/config')->assertOk();
    }

    $this->getJson('/api/config')->assertStatus(429)->assertHeader('Retry-After');
});

it('allows a normal browsing session well under the default limit', function () {
    foreach (range(1, 40) as $i) {
        $this->getJson('/api/places?cell=2/-4/0')->assertOk();
    }
});

it('does not rate limit the health endpoint with the public limiter', function () {
    config(['api.rate_limit' => 1]);
    $this->getJson('/api/config')->assertOk();

    expect($this->getJson('/api/health')->status())->not->toBe(429);
});
