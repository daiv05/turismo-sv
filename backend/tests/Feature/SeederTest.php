<?php

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Zones\Zone;
use Database\Seeders\DatabaseSeeder;
use Spatie\Permission\Models\Role;

it('seeds roles, categories and the five monuments of the historic center', function () {
    $this->seed(DatabaseSeeder::class);

    expect(Role::pluck('name')->sort()->values()->all())->toBe(['super_admin', 'zone_admin'])
        ->and(Category::where('slug', 'monuments')->exists())->toBeTrue();

    $places = Place::query()->published()->get();
    expect($places->pluck('slug')->sort()->values()->all())->toBe([
        'catedral-metropolitana', 'iglesia-el-rosario', 'palacio-nacional', 'plaza-libertad', 'teatro-nacional',
    ]);

    $zone = Zone::where('slug', 'centro-historico')->firstOrFail();
    $outside = DB::selectOne(
        'select count(*) as n from places p join zones z on z.id = ? where not ST_Within(p.location, z.boundary)',
        [$zone->id],
    );
    expect($outside->n)->toBe(0);
});

it('can be run twice without duplicating anything', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    expect(Place::count())->toBe(5)->and(Zone::count())->toBe(3)->and(Category::count())->toBeGreaterThanOrEqual(5);
});

it('serves the seeded monuments through the public API', function () {
    $this->seed(DatabaseSeeder::class);

    $slugs = collect($this->getJson('/api/places?cell=2/-4/0')->json('data'))->pluck('slug')->sort()->values()->all();

    expect($slugs)->toBe(['catedral-metropolitana', 'iglesia-el-rosario', 'palacio-nacional', 'plaza-libertad', 'teatro-nacional']);
});

it('creates no admin user unless asked to', function () {
    $this->seed(DatabaseSeeder::class);

    expect(App\Models\User::count())->toBe(0);
});
