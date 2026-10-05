<?php

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Promotions\Promotion;

/*
 * Scene origin is lon -88.9 lat 13.75, x east and z south. San Salvador's cathedral (-89.191, 13.699)
 * is about 31.5 km west and 5.7 km south of it, so it falls in city cell 2/-4/0.
 */
const CATEDRAL_CELL = '2/-4/0';

function promotion(Place $place, array $overrides = []): Promotion
{
    return Promotion::create(array_merge([
        'place_id' => $place->id,
        'title' => ['es' => 'Café 2x1', 'en' => 'Coffee 2x1'],
        'body' => ['es' => 'Todo el día', 'en' => 'All day'],
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'status' => PlaceStatus::Published,
    ], $overrides));
}

it('returns published places inside the requested cell', function () {
    $inside = Place::factory()->at(-89.191, 13.699)->create(['slug' => 'catedral']);
    Place::factory()->at(-89.56, 13.99)->create();

    $response = $this->getJson('/api/places?cell='.CATEDRAL_CELL)->assertOk();

    expect(collect($response->json('data'))->pluck('slug')->all())->toBe(['catedral'])
        ->and($response->json('cell'))->toBe(CATEDRAL_CELL)
        ->and(round($response->json('data.0.lon'), 3))->toBe(-89.191)
        ->and($response->json('data.0.id'))->toBe($inside->id);
});

it('hides drafts, in review and archived places', function () {
    foreach ([PlaceStatus::Draft, PlaceStatus::InReview, PlaceStatus::Archived] as $status) {
        Place::factory()->at(-89.191, 13.699)->status($status)->create();
    }

    $this->getJson('/api/places?cell='.CATEDRAL_CELL)->assertOk()->assertJsonCount(0, 'data');
});

it('filters by category slugs', function () {
    $museums = Category::factory()->create(['slug' => 'museums']);
    Place::factory()->at(-89.191, 13.699)->create(['category_id' => $museums->id, 'slug' => 'museo']);
    Place::factory()->at(-89.192, 13.698)->create(['slug' => 'otro']);

    $response = $this->getJson('/api/places?cell='.CATEDRAL_CELL.'&categories=museums')->assertOk();

    expect(collect($response->json('data'))->pluck('slug')->all())->toBe(['museo']);
});

it('hides categories that need more zoom than the cell level', function () {
    $fine = Category::factory()->create(['min_zoom' => 3]);
    Place::factory()->at(-89.191, 13.699)->create(['category_id' => $fine->id]);

    $this->getJson('/api/places?cell='.CATEDRAL_CELL)->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/places?cell=3/-13/2')->assertOk()->assertJsonCount(1, 'data');
});

it('translates names according to the locale and falls back to Spanish', function () {
    Place::factory()->at(-89.191, 13.699)->create(['name' => ['es' => 'Catedral', 'en' => 'Cathedral']]);
    Place::factory()->at(-89.192, 13.698)->create(['name' => ['es' => 'Solo español']]);

    $en = collect($this->getJson('/api/places?cell='.CATEDRAL_CELL.'&locale=en')->json('data'))->pluck('name')->sort()->values()->all();
    $es = collect($this->getJson('/api/places?cell='.CATEDRAL_CELL.'&locale=es')->json('data'))->pluck('name')->sort()->values()->all();

    expect($en)->toBe(['Cathedral', 'Solo español'])->and($es)->toBe(['Catedral', 'Solo español']);
});

it('only embeds promotions that are published and inside their window', function () {
    $place = Place::factory()->at(-89.191, 13.699)->create();
    promotion($place, ['title' => ['es' => 'Vigente']]);
    promotion($place, ['title' => ['es' => 'Vencida'], 'starts_at' => now()->subDays(5), 'ends_at' => now()->subDay()]);
    promotion($place, ['title' => ['es' => 'Futura'], 'starts_at' => now()->addDay(), 'ends_at' => now()->addDays(2)]);
    promotion($place, ['title' => ['es' => 'Borrador'], 'status' => PlaceStatus::Draft]);

    $titles = collect($this->getJson('/api/places?cell='.CATEDRAL_CELL)->json('data.0.promotions'))->pluck('title')->all();

    expect($titles)->toBe(['Vigente']);
});

it('treats the promotion end as exclusive', function () {
    $place = Place::factory()->at(-89.191, 13.699)->create();
    $this->travelTo(now()->startOfSecond());
    promotion($place, ['ends_at' => now()]);

    $this->getJson('/api/places?cell='.CATEDRAL_CELL)->assertJsonCount(0, 'data.0.promotions');
});

it('rejects malformed cells and unknown locales', function () {
    $this->getJson('/api/places')->assertStatus(422);
    $this->getJson('/api/places?cell=abc')->assertStatus(422);
    $this->getJson('/api/places?cell=9/0/0')->assertStatus(422);
    $this->getJson('/api/places?cell=2/0/0&locale=fr')->assertStatus(422);
});

it('supports conditional requests with an ETag', function () {
    Place::factory()->at(-89.191, 13.699)->create();

    $first = $this->getJson('/api/places?cell='.CATEDRAL_CELL)->assertOk();
    $etag = $first->headers->get('ETag');

    expect($etag)->not->toBeNull()
        ->and($first->headers->get('Cache-Control'))->toContain('public');
    $this->getJson('/api/places?cell='.CATEDRAL_CELL, ['If-None-Match' => $etag])->assertStatus(304);
});

it('keeps the cell grid in sync with the frontend engine', function () {
    $source = file_get_contents(base_path('../frontend/src/engine/cells.ts'));
    preg_match('/CELL_SIZES[^{]*\{\s*country: ([\d_]+),\s*department: ([\d_]+),\s*city: ([\d_]+),\s*street: ([\d_]+)/s', $source, $m);
    $frontend = array_map(fn ($v) => (int) str_replace('_', '', $v), array_slice($m, 1));

    expect($frontend)->toBe(config('cells.sizes'));
});
