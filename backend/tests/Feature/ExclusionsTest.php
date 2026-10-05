<?php

use App\Domain\Places\ModelStatus;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceModel;
use App\Domain\Places\PlaceModelService;
use App\Models\User;
use App\Domain\Tilesets\TileRebuild;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Storage::fake('s3');
    Role::findOrCreate('super_admin');
    $this->admin = User::factory()->create()->assignRole('super_admin');
});

function approvedModel(Place $place, array $spec = ['footprint' => ['w' => 40, 'd' => 20]], int $version = 1): PlaceModel
{
    $model = PlaceModel::create(['place_id' => $place->id, 'version' => $version, 'source' => 'kit', 'status' => ModelStatus::Draft, 'glb_path' => "models/{$place->id}/v{$version}/model.glb", 'spec' => $spec]);
    app(PlaceModelService::class)->approve($model, test()->admin);

    return $model;
}

it('records a pending tile rebuild when a model is approved', function () {
    $place = Place::factory()->create();

    approvedModel($place);

    expect(TileRebuild::query()->where('status', 'pending')->pluck('place_id')->all())->toBe([$place->id]);
});

it('does not pile up duplicate pending rebuilds for the same place', function () {
    $place = Place::factory()->create();

    approvedModel($place);
    approvedModel($place, version: 2);

    expect(TileRebuild::query()->where('place_id', $place->id)->where('status', 'pending')->count())->toBe(1);
});

it('exports the footprint of every place with a model, and nothing for places without one', function () {
    $with = Place::factory()->at(-89.19, 13.70)->create(['slug' => 'con-modelo']);
    Place::factory()->at(-89.20, 13.71)->create(['slug' => 'sin-modelo']);
    approvedModel($with);
    $path = sys_get_temp_dir().'/excl-'.uniqid().'.json';

    $this->artisan('tilesets:exclusions', ['path' => $path])->assertSuccessful();

    $json = json_decode(file_get_contents($path), true);
    expect($json['type'])->toBe('FeatureCollection')->and($json['features'])->toHaveCount(1)
        ->and($json['features'][0]['properties']['slug'])->toBe('con-modelo')
        ->and($json['features'][0]['geometry']['type'])->toBe('Polygon');
});

it('uses the drawn footprint of the place when it has one', function () {
    $place = Place::factory()->at(-89.19, 13.70)->create(['slug' => 'huella']);
    DB::statement("update places set footprint = ST_SetSRID(ST_GeomFromText('POLYGON((-89.1915 13.6995, -89.1905 13.6995, -89.1905 13.7005, -89.1915 13.7005, -89.1915 13.6995))'), 4326) where id = ?", [$place->id]);
    approvedModel($place);
    $path = sys_get_temp_dir().'/excl-'.uniqid().'.json';

    $this->artisan('tilesets:exclusions', ['path' => $path])->assertSuccessful();

    $ring = json_decode(file_get_contents($path), true)['features'][0]['geometry']['coordinates'][0];
    expect(collect($ring)->pluck(0)->min())->toEqualWithDelta(-89.1915, 1e-6)->and(collect($ring)->pluck(1)->max())->toEqualWithDelta(13.7005, 1e-6);
});

it('falls back to a square the size of the model around the location', function () {
    $place = Place::factory()->at(-89.19, 13.70)->create(['slug' => 'cuadro']);
    approvedModel($place, ['footprint' => ['w' => 60, 'd' => 20]]);
    $path = sys_get_temp_dir().'/excl-'.uniqid().'.json';

    $this->artisan('tilesets:exclusions', ['path' => $path])->assertSuccessful();

    $ring = json_decode(file_get_contents($path), true)['features'][0]['geometry']['coordinates'][0];
    $lons = collect($ring)->pluck(0);
    $widthMeters = ($lons->max() - $lons->min()) * 111_320 * cos(deg2rad(13.7));
    expect($widthMeters)->toBeGreaterThan(55)->toBeLessThan(65);
});

it('closes the pending rebuilds when a new tileset is registered', function () {
    $place = Place::factory()->create();
    approvedModel($place);

    $this->artisan('tilesets:register', ['version' => 'v9', 'base_url' => 'https://cdn.test/v9/'])->assertSuccessful();

    expect(TileRebuild::query()->where('status', 'pending')->count())->toBe(0)->and(TileRebuild::query()->where('status', 'done')->count())->toBe(1);
});

it('keeps rebuilds pending when the version is registered without activating it', function () {
    approvedModel(Place::factory()->create());

    $this->artisan('tilesets:register', ['version' => 'v9', 'base_url' => 'https://cdn.test/v9/', '--no-activate' => true])->assertSuccessful();

    expect(TileRebuild::query()->where('status', 'pending')->count())->toBe(1);
});

it('reports how many rebuilds are waiting', function () {
    approvedModel(Place::factory()->create());
    $path = sys_get_temp_dir().'/excl-'.uniqid().'.json';

    $this->artisan('tilesets:exclusions', ['path' => $path])->expectsOutputToContain('1 pending')->assertSuccessful();
});
