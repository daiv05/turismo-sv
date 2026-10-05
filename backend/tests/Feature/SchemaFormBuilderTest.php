<?php

use App\Filament\Support\SchemaFormBuilder;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;

$schema = [
    'type' => 'object',
    'properties' => [
        'accessible' => ['type' => 'boolean', 'title' => 'Accesible'],
        'fee' => ['type' => 'number', 'minimum' => 0, 'maximum' => 10],
        'kind' => ['type' => 'string', 'enum' => ['public', 'private']],
        'notes' => ['type' => 'string', 'maxLength' => 120],
        'rooms' => ['type' => 'integer'],
        'nested' => ['type' => 'object'],
    ],
    'required' => ['accessible'],
];

it('maps schema property types to form components', function () use ($schema) {
    $components = collect(SchemaFormBuilder::components($schema))->keyBy(fn ($c) => $c->getName());

    expect($components->keys()->all())->toBe(['attributes.accessible', 'attributes.fee', 'attributes.kind', 'attributes.notes', 'attributes.rooms'])
        ->and($components['attributes.accessible'])->toBeInstanceOf(Toggle::class)
        ->and($components['attributes.fee'])->toBeInstanceOf(TextInput::class)
        ->and($components['attributes.kind'])->toBeInstanceOf(Select::class)
        ->and($components['attributes.notes'])->toBeInstanceOf(TextInput::class)
        ->and($components['attributes.rooms'])->toBeInstanceOf(TextInput::class);
});

it('marks required properties as required and numbers as numeric with bounds', function () use ($schema) {
    $components = collect(SchemaFormBuilder::components($schema))->keyBy(fn ($c) => $c->getName());

    expect($components['attributes.accessible']->isRequired())->toBeTrue()
        ->and($components['attributes.fee']->isRequired())->toBeFalse()
        ->and($components['attributes.fee']->isNumeric())->toBeTrue()
        ->and($components['attributes.fee']->getMinValue())->toEqual(0)
        ->and($components['attributes.fee']->getMaxValue())->toEqual(10)
        ->and($components['attributes.notes']->getMaxLength())->toBe(120);
});

it('offers the enum values as options', function () use ($schema) {
    $kind = collect(SchemaFormBuilder::components($schema))->first(fn ($c) => $c->getName() === 'attributes.kind');

    expect($kind->getOptions())->toBe(['public' => 'public', 'private' => 'private']);
});

it('uses the title as label when present', function () use ($schema) {
    $accessible = collect(SchemaFormBuilder::components($schema))->first(fn ($c) => $c->getName() === 'attributes.accessible');

    expect($accessible->getLabel())->toBe('Accesible');
});

it('returns nothing for empty or schema-less categories', function () {
    expect(SchemaFormBuilder::components(null))->toBe([])
        ->and(SchemaFormBuilder::components([]))->toBe([])
        ->and(SchemaFormBuilder::components(['type' => 'object']))->toBe([]);
});
