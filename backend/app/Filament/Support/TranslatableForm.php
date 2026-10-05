<?php

namespace App\Filament\Support;

use Illuminate\Database\Eloquent\Model;

/**
 * Helpers for forms that edit Spatie translatable attributes as one field per locale (`name.es`, `name.en`).
 */
final class TranslatableForm
{
    /**
     * Replaces the current-locale strings the model serializes with the full locale maps.
     *
     * @param  array<string, mixed>  $data
     * @param  list<string>  $attributes
     * @return array<string, mixed>
     */
    public static function fill(array $data, Model $record, array $attributes): array
    {
        foreach ($attributes as $attribute) {
            $data[$attribute] = $record->getTranslations($attribute);
        }

        return $data;
    }
}
