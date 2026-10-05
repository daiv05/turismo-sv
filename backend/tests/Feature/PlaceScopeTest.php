<?php

use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Zones\Zone;
use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
});

function zoneAdminOf(Zone $zone): User
{
    $user = User::factory()->create();
    $user->assignRole('zone_admin');
    $user->zones()->attach($zone);

    return $user;
}

it('limits a zone admin to places inside their zones', function () {
    $centro = Zone::factory()->bounds(-89.25, 13.68, -89.15, 13.72)->create();
    $inside = Place::factory()->at(-89.19, 13.70)->create();
    Place::factory()->at(-89.56, 13.99)->create();

    $visible = Place::query()->visibleTo(zoneAdminOf($centro))->pluck('id');

    expect($visible->all())->toBe([$inside->id]);
});

it('gives a super admin every place', function () {
    Place::factory()->at(-89.19, 13.70)->create();
    Place::factory()->at(-89.56, 13.99)->create();
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    expect(Place::query()->visibleTo($admin)->count())->toBe(2);
});

it('gives a zone admin without zones nothing', function () {
    Place::factory()->create();
    $user = User::factory()->create();
    $user->assignRole('zone_admin');

    expect(Place::query()->visibleTo($user)->count())->toBe(0);
});

it('combines several zones of the same admin', function () {
    $a = Zone::factory()->bounds(-89.25, 13.68, -89.15, 13.72)->create();
    $b = Zone::factory()->bounds(-89.60, 13.95, -89.50, 14.05)->create();
    $user = zoneAdminOf($a);
    $user->zones()->attach($b);
    Place::factory()->at(-89.19, 13.70)->create();
    Place::factory()->at(-89.56, 13.99)->create();
    Place::factory()->at(-88.0, 13.5)->create();

    expect(Place::query()->visibleTo($user)->count())->toBe(2);
});

it('exposes coordinates and hides raw geometry', function () {
    Place::factory()->at(-89.19, 13.70)->create();

    $place = Place::query()->withCoordinates()->firstOrFail();

    expect(round((float) $place->lon, 4))->toBe(-89.19)
        ->and(round((float) $place->lat, 4))->toBe(13.7)
        ->and($place->toArray())->not->toHaveKeys(['location', 'footprint']);
});

it('only counts published places through the published scope', function () {
    Place::factory()->create();
    Place::factory()->status(PlaceStatus::Draft)->create();

    expect(Place::query()->published()->count())->toBe(1);
});
