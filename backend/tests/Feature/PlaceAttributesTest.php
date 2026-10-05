<?php

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use Illuminate\Validation\ValidationException;

function toiletCategory(): Category
{
    return Category::factory()->create([
        'slug' => 'toilets',
        'attributes_schema' => [
            'type' => 'object',
            'properties' => [
                'fee' => ['type' => 'number', 'minimum' => 0],
                'accessible' => ['type' => 'boolean'],
            ],
            'required' => ['accessible'],
            'additionalProperties' => false,
        ],
    ]);
}

it('accepts attributes that satisfy the category schema', function () {
    $place = Place::factory()->create(['category_id' => toiletCategory()->id, 'attributes' => ['accessible' => true, 'fee' => 0.25]]);

    expect($place->fresh()->attributes)->toBe(['accessible' => true, 'fee' => 0.25]);
});

it('rejects attributes that violate the schema with readable messages', function () {
    try {
        Place::factory()->create(['category_id' => toiletCategory()->id, 'attributes' => ['accessible' => 'yes', 'fee' => -1]]);
        $this->fail('Expected a validation error');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('attributes')
            ->and(implode(' ', $e->errors()['attributes']))->toContain('accessible')->toContain('fee');
    }
});

it('rejects missing required attributes and unknown keys', function () {
    $category = toiletCategory();

    expect(fn () => Place::factory()->create(['category_id' => $category->id, 'attributes' => ['fee' => 1]]))
        ->toThrow(ValidationException::class);
    expect(fn () => Place::factory()->create(['category_id' => $category->id, 'attributes' => ['accessible' => true, 'extra' => 1]]))
        ->toThrow(ValidationException::class);
});

it('validates again when the category changes', function () {
    $place = Place::factory()->create(['attributes' => ['anything' => 1]]);

    expect(fn () => $place->update(['category_id' => toiletCategory()->id]))->toThrow(ValidationException::class);
});

it('skips validation for categories without a schema', function () {
    $place = Place::factory()->create(['attributes' => ['anything' => ['goes' => true]]]);

    expect($place->fresh()->attributes)->toBe(['anything' => ['goes' => true]]);
});

it('treats missing attributes as an empty object', function () {
    $category = Category::factory()->create(['attributes_schema' => ['type' => 'object', 'properties' => ['a' => ['type' => 'string']]]]);

    expect(Place::factory()->create(['category_id' => $category->id, 'attributes' => null])->exists)->toBeTrue();
});
