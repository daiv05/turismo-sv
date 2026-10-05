<?php

use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Promotions\Promotion;
use App\Domain\Zones\Zone;
use App\Filament\Resources\Promotions\Pages\CreatePromotion;
use App\Filament\Resources\Promotions\Pages\EditPromotion;
use App\Filament\Resources\Promotions\Pages\ListPromotions;
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    config(['filesystems.default' => 's3']);
    Storage::fake('s3');
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
    Filament::setCurrentPanel('admin');
    $zone = Zone::factory()->bounds(-89.25, 13.68, -89.15, 13.72)->create();
    $this->superAdmin = User::factory()->create()->assignRole('super_admin');
    $this->zoneAdmin = User::factory()->create()->assignRole('zone_admin');
    $this->zoneAdmin->zones()->attach($zone);
    $this->inside = Place::factory()->at(-89.19, 13.70)->create();
    $this->outside = Place::factory()->at(-89.56, 13.99)->create();
});

function promotionData(array $over = []): array
{
    return array_merge([
        'place_id' => test()->inside->id,
        'title' => ['es' => 'Café 2x1', 'en' => 'Coffee 2x1'],
        'body' => ['es' => 'Todo el día', 'en' => 'All day'],
        'starts_at' => now()->subDay()->toDateTimeString(),
        'ends_at' => now()->addWeek()->toDateTimeString(),
        'priority' => 1,
        'sprite_type' => 'template',
        'template_key' => 'percent-off',
        'template_data' => ['value' => 25],
    ], $over);
}

function existing(Place $place, array $over = []): Promotion
{
    return Promotion::create(array_merge([
        'place_id' => $place->id, 'title' => ['es' => 'P'], 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(),
        'status' => PlaceStatus::Draft, 'sprite_type' => 'template', 'template_key' => 'new',
    ], $over));
}

it('lists only promotions of places the user can reach', function () {
    $mine = existing($this->inside);
    $theirs = existing($this->outside);

    Livewire::actingAs($this->zoneAdmin)->test(ListPromotions::class)->assertCanSeeTableRecords([$mine])->assertCanNotSeeTableRecords([$theirs]);
    Livewire::actingAs($this->superAdmin)->test(ListPromotions::class)->assertCanSeeTableRecords([$mine, $theirs]);
});

it('creates a draft template promotion for a place in the zone', function () {
    Livewire::actingAs($this->zoneAdmin)->test(CreatePromotion::class)->fillForm(promotionData())->call('create')->assertHasNoFormErrors();

    $promotion = Promotion::firstOrFail();
    expect($promotion->status)->toBe(PlaceStatus::Draft)->and($promotion->template_data)->toEqual(['value' => 25])
        ->and($promotion->getTranslation('title', 'en'))->toBe('Coffee 2x1');
});

it('only offers places inside the zones of a zone admin', function () {
    Livewire::actingAs($this->zoneAdmin)->test(CreatePromotion::class)
        ->fillForm(promotionData(['place_id' => $this->outside->id]))
        ->call('create')
        ->assertHasFormErrors(['place_id']);

    expect(Promotion::count())->toBe(0);
});

it('ignores a published status sent by a zone admin', function () {
    Livewire::actingAs($this->zoneAdmin)->test(CreatePromotion::class)->fillForm(promotionData() + ['status' => 'published'])->call('create');

    expect(Promotion::firstOrFail()->status)->toBe(PlaceStatus::Draft);
});

it('shows domain validation problems as form errors', function () {
    Livewire::actingAs($this->zoneAdmin)->test(CreatePromotion::class)
        ->fillForm(promotionData(['ends_at' => now()->subWeek()->toDateTimeString()]))
        ->call('create')
        ->assertHasFormErrors(['ends_at']);

    Livewire::actingAs($this->zoneAdmin)->test(CreatePromotion::class)
        ->fillForm(promotionData(['template_data' => ['value' => 500]]))
        ->call('create')
        ->assertHasFormErrors(['template_data']);
});

it('stores an uploaded spritesheet with its grid', function () {
    Livewire::actingAs($this->zoneAdmin)->test(CreatePromotion::class)
        ->fillForm(promotionData([
            'sprite_type' => 'spritesheet', 'template_key' => null, 'template_data' => null,
            'sprite_image' => UploadedFile::fake()->image('fire.png', 256, 128),
            'sprite_frames' => 6, 'sprite_cols' => 3, 'sprite_rows' => 2, 'sprite_fps' => 10,
        ]))
        ->call('create')
        ->assertHasNoFormErrors();

    $promotion = Promotion::firstOrFail();
    expect($promotion->sprite_frames)->toBe(6)->and($promotion->sprite_path)->toStartWith('sprites/');
    Storage::disk('s3')->assertExists($promotion->sprite_path);
});

it('lets a zone admin submit but only a super admin approve or reject', function () {
    $promotion = existing($this->inside);

    Livewire::actingAs($this->zoneAdmin)->test(EditPromotion::class, ['record' => $promotion->getKey()])
        ->assertActionHidden('approve')
        ->callAction('submitForReview');
    expect($promotion->fresh()->status)->toBe(PlaceStatus::InReview);

    Livewire::actingAs($this->superAdmin)->test(EditPromotion::class, ['record' => $promotion->getKey()])->callAction('approve');
    expect($promotion->fresh()->status)->toBe(PlaceStatus::Published);

    $promotion->fresh()->update(['status' => PlaceStatus::InReview]);
    Livewire::actingAs($this->superAdmin)->test(EditPromotion::class, ['record' => $promotion->getKey()])->callAction('reject');
    expect($promotion->fresh()->status)->toBe(PlaceStatus::Draft);
});

it('withdraws a published promotion into review when a zone admin edits it', function () {
    $promotion = existing($this->inside, ['status' => PlaceStatus::Published]);

    Livewire::actingAs($this->zoneAdmin)->test(EditPromotion::class, ['record' => $promotion->getKey()])->fillForm(['priority' => 5])->call('save');

    expect($promotion->fresh()->status)->toBe(PlaceStatus::InReview);
});

it('hides delete from zone admins and blocks promotions outside the zone', function () {
    $mine = existing($this->inside);
    $theirs = existing($this->outside);

    Livewire::actingAs($this->zoneAdmin)->test(EditPromotion::class, ['record' => $mine->getKey()])->assertActionHidden('delete');
    $this->actingAs($this->zoneAdmin)->get("/admin/promotions/{$theirs->getKey()}/edit")->assertNotFound();
});
