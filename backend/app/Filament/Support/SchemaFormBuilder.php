<?php

namespace App\Filament\Support;

use Filament\Forms\Components\Field;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;

/**
 * Turns the flat properties of a category's JSON Schema into form components for a place's attributes.
 * Nested objects and arrays are skipped; they are still validated on save.
 */
final class SchemaFormBuilder
{
    /**
     * @param  array<string, mixed>|null  $schema
     * @return list<Field>
     */
    public static function components(?array $schema, string $prefix = 'attributes'): array
    {
        $properties = $schema['properties'] ?? [];
        $required = $schema['required'] ?? [];
        $components = [];

        foreach ($properties as $name => $definition) {
            $component = self::component("{$prefix}.{$name}", (string) $name, (array) $definition);
            if ($component === null) {
                continue;
            }
            if (in_array($name, $required, true)) {
                $component->required();
            }
            $components[] = $component;
        }

        return $components;
    }

    /** @param  array<string, mixed>  $definition */
    private static function component(string $path, string $name, array $definition): ?Field
    {
        $label = $definition['title'] ?? ucfirst(str_replace('_', ' ', $name));

        if (isset($definition['enum']) && is_array($definition['enum'])) {
            return Select::make($path)->label($label)->options(array_combine($definition['enum'], $definition['enum']));
        }

        return match ($definition['type'] ?? null) {
            'boolean' => Toggle::make($path)->label($label),
            'number', 'integer' => self::numeric($path, $label, $definition),
            'string' => self::text($path, $label, $definition),
            default => null,
        };
    }

    /** @param  array<string, mixed>  $definition */
    private static function numeric(string $path, string $label, array $definition): TextInput
    {
        $input = TextInput::make($path)->label($label)->numeric();
        if (($definition['type'] ?? null) === 'integer') {
            $input->integer();
        }
        if (isset($definition['minimum'])) {
            $input->minValue($definition['minimum']);
        }
        if (isset($definition['maximum'])) {
            $input->maxValue($definition['maximum']);
        }

        return $input;
    }

    /** @param  array<string, mixed>  $definition */
    private static function text(string $path, string $label, array $definition): TextInput
    {
        $input = TextInput::make($path)->label($label);
        if (isset($definition['maxLength'])) {
            $input->maxLength((int) $definition['maxLength']);
        }

        return $input;
    }
}
