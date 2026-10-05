<?php

use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Promotions\Promotion;
use App\Domain\Promotions\PromotionWorkflow;
use App\Domain\Zones\Zone;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
    $zone = Zone::factory()->bounds(-89.25, 13.68, -89.15, 13.72)->create();
    $this->superAdmin = User::factory()->create()->assignRole('super_admin');
    $this->zoneAdmin = User::factory()->create()->assignRole('zone_admin');
    $this->zoneAdmin->zones()->attach($zone);
    $this->inside = Place::factory()->at(-89.19, 13.70)->create();
    $this->outside = Place::factory()->at(-89.56, 13.99)->create();
    $this->workflow = new PromotionWorkflow();
});

function promo(Place $place, array $over = []): Promotion
{
    return Promotion::create(array_merge([
        'place_id' => $place->id,
        'title' => ['es' => 'Promo', 'en' => 'Deal'],
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'status' => PlaceStatus::Draft,
        'sprite_type' => 'template',
        'template_key' => 'percent-off',
        'template_data' => ['value' => 20],
    ], $over));
}

it('limits promotions to the zones of a zone admin through their place', function () {
    $mine = promo($this->inside);
    promo($this->outside);

    expect(Promotion::query()->visibleTo($this->zoneAdmin)->pluck('id')->all())->toBe([$mine->id])
        ->and(Promotion::query()->visibleTo($this->superAdmin)->count())->toBe(2);
});

it('lets a zone admin submit a draft inside their zone and a super admin publish it', function () {
    $promotion = promo($this->inside);

    $this->workflow->submitForReview($promotion, $this->zoneAdmin);
    expect($promotion->fresh()->status)->toBe(PlaceStatus::InReview);

    expect(fn () => $this->workflow->approve($promotion->fresh(), $this->zoneAdmin))->toThrow(AuthorizationException::class);
    $this->workflow->approve($promotion->fresh(), $this->superAdmin);
    expect($promotion->fresh()->status)->toBe(PlaceStatus::Published);
});

it('does not let a zone admin touch promotions outside their zones', function () {
    $promotion = promo($this->outside);

    expect(fn () => $this->workflow->submitForReview($promotion, $this->zoneAdmin))->toThrow(AuthorizationException::class);
});

it('sends rejected promotions back to draft and withdraws edited published ones', function () {
    $promotion = promo($this->inside, ['status' => PlaceStatus::InReview]);
    $this->workflow->reject($promotion, $this->superAdmin);
    expect($promotion->fresh()->status)->toBe(PlaceStatus::Draft);

    $published = promo($this->inside, ['status' => PlaceStatus::Published]);
    $this->workflow->recordEditBy($published, $this->zoneAdmin);
    expect($published->fresh()->status)->toBe(PlaceStatus::InReview);

    $kept = promo($this->inside, ['status' => PlaceStatus::Published]);
    $this->workflow->recordEditBy($kept, $this->superAdmin);
    expect($kept->fresh()->status)->toBe(PlaceStatus::Published);
});

it('enforces the same rules through the policy', function () {
    $mine = promo($this->inside);
    $theirs = promo($this->outside);

    expect(Gate::forUser($this->zoneAdmin)->allows('update', $mine))->toBeTrue()
        ->and(Gate::forUser($this->zoneAdmin)->allows('update', $theirs))->toBeFalse()
        ->and(Gate::forUser($this->zoneAdmin)->allows('publish', $mine))->toBeFalse()
        ->and(Gate::forUser($this->zoneAdmin)->allows('delete', $mine))->toBeFalse()
        ->and(Gate::forUser($this->superAdmin)->allows('publish', $theirs))->toBeTrue();
});

describe('invariants', function () {
    it('requires the end to be after the start', function () {
        expect(fn () => promo($this->inside, ['starts_at' => now(), 'ends_at' => now()->subHour()]))->toThrow(ValidationException::class);
        expect(fn () => promo($this->inside, ['starts_at' => now(), 'ends_at' => now()]))->toThrow(ValidationException::class);
    });

    it('requires a spritesheet to have consistent frames', function () {
        $sheet = ['sprite_type' => 'spritesheet', 'template_key' => null, 'template_data' => null, 'sprite_path' => 'sprites/a.png'];

        expect(fn () => promo($this->inside, $sheet + ['sprite_frames' => 1, 'sprite_cols' => 1, 'sprite_rows' => 1]))->toThrow(ValidationException::class);
        expect(fn () => promo($this->inside, $sheet + ['sprite_frames' => 9, 'sprite_cols' => 2, 'sprite_rows' => 2]))->toThrow(ValidationException::class);
        expect(fn () => promo($this->inside, $sheet + ['sprite_frames' => 4, 'sprite_cols' => 2, 'sprite_rows' => 2, 'sprite_fps' => 0]))->toThrow(ValidationException::class);
        expect(promo($this->inside, $sheet + ['sprite_frames' => 4, 'sprite_cols' => 2, 'sprite_rows' => 2, 'sprite_fps' => 8])->exists)->toBeTrue();
    });

    it('requires an image for static and spritesheet sprites', function () {
        expect(fn () => promo($this->inside, ['sprite_type' => 'static', 'template_key' => null, 'template_data' => null, 'sprite_path' => null]))->toThrow(ValidationException::class);
        expect(promo($this->inside, ['sprite_type' => 'static', 'template_key' => null, 'template_data' => null, 'sprite_path' => 'sprites/a.png'])->exists)->toBeTrue();
    });

    it('requires a known template for template sprites', function () {
        expect(fn () => promo($this->inside, ['template_key' => 'nonsense']))->toThrow(ValidationException::class);
        expect(fn () => promo($this->inside, ['template_key' => null]))->toThrow(ValidationException::class);
    });

    it('validates the template data of the chosen template', function () {
        expect(fn () => promo($this->inside, ['template_key' => 'percent-off', 'template_data' => ['value' => 150]]))->toThrow(ValidationException::class);
        expect(fn () => promo($this->inside, ['template_key' => 'percent-off', 'template_data' => []]))->toThrow(ValidationException::class);
        expect(promo($this->inside, ['template_key' => 'two-for-one', 'template_data' => null])->exists)->toBeTrue();
    });
});
