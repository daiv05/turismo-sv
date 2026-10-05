<?php

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Zones\Zone;
use App\Filament\Resources\Places\Pages\CreatePlace;
use App\Filament\Resources\Places\Pages\EditPlace;
use App\Filament\Resources\Places\Pages\ListPlaces;
use App\Models\User;
use Filament\Facades\Filament;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
    Filament::setCurrentPanel('admin');
    $this->zone = Zone::factory()->bounds(-89.25, 13.68, -89.15, 13.72)->create();
    $this->superAdmin = User::factory()->create()->assignRole('super_admin');
    $this->zoneAdmin = User::factory()->create()->assignRole('zone_admin');
    $this->zoneAdmin->zones()->attach($this->zone);
    $this->category = Category::factory()->create();
});

function placeData(array $overrides = []): array
{
    return array_merge([
        'category_id' => test()->category->id,
        'slug' => 'teatro-nacional',
        'name' => ['es' => 'Teatro Nacional', 'en' => 'National Theatre'],
        'summary' => ['es' => 'Resumen', 'en' => 'Summary'],
        'lon' => -89.19,
        'lat' => 13.70,
    ], $overrides);
}

it('lists only the places a zone admin can reach', function () {
    $mine = Place::factory()->at(-89.19, 13.70)->create();
    $other = Place::factory()->at(-89.56, 13.99)->create();

    Livewire::actingAs($this->zoneAdmin)->test(ListPlaces::class)
        ->assertCanSeeTableRecords([$mine])
        ->assertCanNotSeeTableRecords([$other]);
});

it('lists every place for a super admin', function () {
    $records = [Place::factory()->at(-89.19, 13.70)->create(), Place::factory()->at(-89.56, 13.99)->create()];

    Livewire::actingAs($this->superAdmin)->test(ListPlaces::class)->assertCanSeeTableRecords($records);
});

it('creates a draft inside the zone of a zone admin and records the author', function () {
    Livewire::actingAs($this->zoneAdmin)->test(CreatePlace::class)
        ->fillForm(placeData())
        ->call('create')
        ->assertHasNoFormErrors();

    $place = Place::query()->withCoordinates()->where('slug', 'teatro-nacional')->firstOrFail();
    expect($place->status)->toBe(PlaceStatus::Draft)
        ->and($place->created_by)->toBe($this->zoneAdmin->id)
        ->and(round((float) $place->lon, 3))->toBe(-89.19)
        ->and($place->getTranslation('name', 'en'))->toBe('National Theatre');
});

it('refuses a location outside the zones of a zone admin', function () {
    Livewire::actingAs($this->zoneAdmin)->test(CreatePlace::class)
        ->fillForm(placeData(['lon' => -89.56, 'lat' => 13.99]))
        ->call('create')
        ->assertHasFormErrors(['lon']);

    expect(Place::count())->toBe(0);
});

it('lets a super admin place anywhere', function () {
    Livewire::actingAs($this->superAdmin)->test(CreatePlace::class)
        ->fillForm(placeData(['lon' => -89.56, 'lat' => 13.99]))
        ->call('create')
        ->assertHasNoFormErrors();

    expect(Place::count())->toBe(1);
});

it('ignores a status sent by a zone admin when creating', function () {
    Livewire::actingAs($this->zoneAdmin)->test(CreatePlace::class)
        ->fillForm(placeData() + ['status' => 'published'])
        ->call('create');

    expect(Place::firstOrFail()->status)->toBe(PlaceStatus::Draft);
});

it('renders and saves attribute fields from the category schema', function () {
    $category = Category::factory()->create(['attributes_schema' => [
        'type' => 'object',
        'properties' => ['accessible' => ['type' => 'boolean'], 'fee' => ['type' => 'number', 'minimum' => 0]],
        'required' => ['accessible'],
    ]]);

    Livewire::actingAs($this->zoneAdmin)->test(CreatePlace::class)
        ->fillForm(placeData(['category_id' => $category->id, 'attributes' => ['accessible' => true, 'fee' => 0.5]]))
        ->call('create')
        ->assertHasNoFormErrors();

    expect(Place::firstOrFail()->getAttribute('attributes'))->toEqual(['accessible' => true, 'fee' => 0.5]);
});

it('requires the required attribute fields', function () {
    $category = Category::factory()->create(['attributes_schema' => [
        'type' => 'object',
        'properties' => ['accessible' => ['type' => 'boolean']],
        'required' => ['accessible'],
    ]]);

    Livewire::actingAs($this->zoneAdmin)->test(CreatePlace::class)
        ->fillForm(placeData(['category_id' => $category->id]))
        ->call('create')
        ->assertHasFormErrors(['attributes.accessible']);
});

it('loads translations and coordinates into the edit form', function () {
    $place = Place::factory()->at(-89.19, 13.70)->create(['name' => ['es' => 'Catedral', 'en' => 'Cathedral']]);

    Livewire::actingAs($this->zoneAdmin)->test(EditPlace::class, ['record' => $place->getKey()])
        ->assertFormSet(['name.es' => 'Catedral', 'name.en' => 'Cathedral', 'lon' => -89.19, 'lat' => 13.7]);
});

it('moves the place when coordinates change and keeps it inside the zone', function () {
    $place = Place::factory()->at(-89.19, 13.70)->create();

    Livewire::actingAs($this->zoneAdmin)->test(EditPlace::class, ['record' => $place->getKey()])
        ->fillForm(['lon' => -89.20, 'lat' => 13.71])
        ->call('save')
        ->assertHasNoFormErrors();

    $moved = Place::query()->withCoordinates()->findOrFail($place->id);
    expect(round((float) $moved->lon, 3))->toBe(-89.2);

    Livewire::actingAs($this->zoneAdmin)->test(EditPlace::class, ['record' => $place->getKey()])
        ->fillForm(['lon' => -89.56, 'lat' => 13.99])
        ->call('save')
        ->assertHasFormErrors(['lon']);
});

it('withdraws a published place into review when a zone admin edits it', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::Published)->create();

    Livewire::actingAs($this->zoneAdmin)->test(EditPlace::class, ['record' => $place->getKey()])
        ->fillForm(['name.es' => 'Nuevo nombre'])
        ->call('save');

    expect($place->fresh()->status)->toBe(PlaceStatus::InReview);
});

it('lets a zone admin submit a draft for review but not approve', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::Draft)->create();

    Livewire::actingAs($this->zoneAdmin)->test(EditPlace::class, ['record' => $place->getKey()])
        ->assertActionHidden('approve')
        ->callAction('submitForReview');

    expect($place->fresh()->status)->toBe(PlaceStatus::InReview);
});

it('lets a super admin approve and reject places in review', function () {
    $place = Place::factory()->at(-89.19, 13.70)->status(PlaceStatus::InReview)->create();

    Livewire::actingAs($this->superAdmin)->test(EditPlace::class, ['record' => $place->getKey()])
        ->callAction('approve');
    expect($place->fresh()->status)->toBe(PlaceStatus::Published);

    $place->fresh()->update(['status' => PlaceStatus::InReview]);
    Livewire::actingAs($this->superAdmin)->test(EditPlace::class, ['record' => $place->getKey()])
        ->callAction('reject');
    expect($place->fresh()->status)->toBe(PlaceStatus::Draft);
});

it('hides the delete action from zone admins', function () {
    $place = Place::factory()->at(-89.19, 13.70)->create();

    Livewire::actingAs($this->zoneAdmin)->test(EditPlace::class, ['record' => $place->getKey()])->assertActionHidden('delete');
});

it('forbids opening a place outside the zone', function () {
    $outside = Place::factory()->at(-89.56, 13.99)->create();

    $this->actingAs($this->zoneAdmin)->get("/admin/places/{$outside->getKey()}/edit")->assertNotFound();
});
