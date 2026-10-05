<?php

use App\Domain\Categories\Category;
use App\Domain\Zones\Zone;
use App\Filament\Resources\Categories\Pages\CreateCategory;
use App\Filament\Resources\Categories\Pages\EditCategory;
use App\Filament\Resources\Zones\Pages\CreateZone;
use App\Filament\Resources\Zones\Pages\EditZone;
use App\Models\User;
use Filament\Facades\Filament;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
    Filament::setCurrentPanel('admin');
    $this->superAdmin = User::factory()->create()->assignRole('super_admin');
    $this->zoneAdmin = User::factory()->create()->assignRole('zone_admin');
});

it('keeps zone admins out of categories and zones', function (string $path) {
    $this->actingAs($this->zoneAdmin)->get($path)->assertForbidden();
    $this->actingAs($this->superAdmin)->get($path)->assertOk();
})->with(['/admin/categories', '/admin/zones']);

it('creates a category with a palette color and a JSON schema', function () {
    Livewire::actingAs($this->superAdmin)->test(CreateCategory::class)
        ->fillForm([
            'slug' => 'toilets',
            'name' => ['es' => 'Baños', 'en' => 'Toilets'],
            'icon' => 'toilet',
            'color_token' => 'accent',
            'kind' => 'service',
            'min_zoom' => 2,
            'sort' => 3,
            'attributes_schema' => '{"type":"object","properties":{"fee":{"type":"number"}}}',
        ])
        ->call('create')
        ->assertHasNoFormErrors();

    $category = Category::firstOrFail();
    expect($category->attributes_schema['properties']['fee']['type'])->toBe('number')
        ->and($category->getTranslation('name', 'en'))->toBe('Toilets');
});

it('rejects schemas that are not valid JSON or not valid JSON schemas', function (string $schema) {
    Livewire::actingAs($this->superAdmin)->test(CreateCategory::class)
        ->fillForm([
            'slug' => 'x', 'name' => ['es' => 'X', 'en' => 'X'], 'icon' => 'x', 'color_token' => 'accent',
            'kind' => 'service', 'min_zoom' => 0, 'sort' => 0, 'attributes_schema' => $schema,
        ])
        ->call('create')
        ->assertHasFormErrors(['attributes_schema']);
})->with(['{not json', '{"type":"nonsense"}']);

it('only offers palette roles as category colors', function () {
    Livewire::actingAs($this->superAdmin)->test(CreateCategory::class)
        ->fillForm([
            'slug' => 'x', 'name' => ['es' => 'X', 'en' => 'X'], 'icon' => 'x', 'color_token' => '#FF0000',
            'kind' => 'service', 'min_zoom' => 0, 'sort' => 0,
        ])
        ->call('create')
        ->assertHasFormErrors(['color_token']);
});

it('shows the stored schema as JSON when editing a category', function () {
    $category = Category::factory()->create(['attributes_schema' => ['type' => 'object']]);

    Livewire::actingAs($this->superAdmin)->test(EditCategory::class, ['record' => $category->getKey()])
        ->assertFormSet(fn (array $state) => json_decode($state['attributes_schema'], true) === ['type' => 'object']);
});

it('creates a zone with boundary GeoJSON and a camera', function () {
    Livewire::actingAs($this->superAdmin)->test(CreateZone::class)
        ->fillForm([
            'slug' => 'centro',
            'name' => ['es' => 'Centro', 'en' => 'Downtown'],
            'type' => 'tourist_district',
            'boundary_geojson' => '{"type":"Polygon","coordinates":[[[-89.2,13.69],[-89.18,13.69],[-89.18,13.71],[-89.2,13.71],[-89.2,13.69]]]}',
            'camera' => ['lon' => -89.19, 'lat' => 13.7, 'distance' => 1500],
        ])
        ->call('create')
        ->assertHasNoFormErrors();

    $zone = Zone::firstOrFail();
    $contains = DB::selectOne('select ST_Within(ST_SetSRID(ST_MakePoint(-89.19, 13.70), 4326), boundary) as inside from zones where id = ?', [$zone->id]);
    expect($contains->inside)->toBeTrue()->and($zone->camera['distance'])->toEqual(1500);
});

it('rejects boundaries that are not polygons', function () {
    Livewire::actingAs($this->superAdmin)->test(CreateZone::class)
        ->fillForm([
            'slug' => 'x', 'name' => ['es' => 'X', 'en' => 'X'], 'type' => 'municipality',
            'boundary_geojson' => '{"type":"Point","coordinates":[-89.2,13.7]}',
        ])
        ->call('create')
        ->assertHasFormErrors(['boundary_geojson']);
});

it('round trips the boundary through the edit form', function () {
    $zone = Zone::factory()->bounds(-89.25, 13.68, -89.15, 13.72)->create();

    Livewire::actingAs($this->superAdmin)->test(EditZone::class, ['record' => $zone->getKey()])
        ->call('save')
        ->assertHasNoFormErrors();

    $still = DB::selectOne('select ST_Within(ST_SetSRID(ST_MakePoint(-89.19, 13.70), 4326), boundary) as inside from zones where id = ?', [$zone->id]);
    expect($still->inside)->toBeTrue();
});
