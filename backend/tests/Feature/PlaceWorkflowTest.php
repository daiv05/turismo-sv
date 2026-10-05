<?php

use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Places\PlaceWorkflow;
use App\Domain\Zones\Zone;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Gate;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
    $this->zone = Zone::factory()->bounds(-89.25, 13.68, -89.15, 13.72)->create();
    $this->superAdmin = User::factory()->create()->assignRole('super_admin');
    $this->zoneAdmin = User::factory()->create()->assignRole('zone_admin');
    $this->zoneAdmin->zones()->attach($this->zone);
    $this->workflow = new PlaceWorkflow();
});

it('lets a zone admin submit a draft inside their zone for review', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::Draft)->create();

    $this->workflow->submitForReview($place, $this->zoneAdmin);

    expect($place->fresh()->status)->toBe(PlaceStatus::InReview);
});

it('does not let a zone admin touch places outside their zones', function () {
    $place = Place::factory()->at(-89.56, 13.99)->status(PlaceStatus::Draft)->create();

    expect(fn () => $this->workflow->submitForReview($place, $this->zoneAdmin))->toThrow(AuthorizationException::class);
});

it('does not let a zone admin publish', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::InReview)->create();

    expect(fn () => $this->workflow->approve($place, $this->zoneAdmin))->toThrow(AuthorizationException::class);
    expect($place->fresh()->status)->toBe(PlaceStatus::InReview);
});

it('lets a super admin approve and publish a place in review', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::InReview)->create();

    $this->workflow->approve($place, $this->superAdmin);

    expect($place->fresh()->status)->toBe(PlaceStatus::Published);
});

it('only approves places that are in review', function () {
    $draft = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::Draft)->create();

    expect(fn () => $this->workflow->approve($draft, $this->superAdmin))->toThrow(InvalidArgumentException::class);
});

it('sends a rejected place back to draft', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::InReview)->create();

    $this->workflow->reject($place, $this->superAdmin);

    expect($place->fresh()->status)->toBe(PlaceStatus::Draft);
});

it('sends a published place back to review when a zone admin edits it', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::Published)->create();

    $this->workflow->recordEditBy($place, $this->zoneAdmin);

    expect($place->fresh()->status)->toBe(PlaceStatus::InReview);
});

it('keeps a published place published when a super admin edits it', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::Published)->create();

    $this->workflow->recordEditBy($place, $this->superAdmin);

    expect($place->fresh()->status)->toBe(PlaceStatus::Published);
});

it('checks that a new location lies inside the zones of a zone admin', function () {
    expect($this->workflow->canPlaceAt($this->zoneAdmin, -89.19, 13.70))->toBeTrue()
        ->and($this->workflow->canPlaceAt($this->zoneAdmin, -89.56, 13.99))->toBeFalse()
        ->and($this->workflow->canPlaceAt($this->superAdmin, -89.56, 13.99))->toBeTrue();
});

it('enforces the same rules through the place policy', function () {
    $inside = Place::factory()->at(-89.19, 13.70)->create();
    $outside = Place::factory()->at(-89.56, 13.99)->create();

    expect(Gate::forUser($this->zoneAdmin)->allows('update', $inside))->toBeTrue()
        ->and(Gate::forUser($this->zoneAdmin)->allows('update', $outside))->toBeFalse()
        ->and(Gate::forUser($this->zoneAdmin)->allows('publish', $inside))->toBeFalse()
        ->and(Gate::forUser($this->superAdmin)->allows('publish', $outside))->toBeTrue()
        ->and(Gate::forUser($this->zoneAdmin)->allows('delete', $inside))->toBeFalse();
});
