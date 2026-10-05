<?php

namespace App\Domain\Places;

use App\Domain\Categories\Category;
use Illuminate\Validation\ValidationException;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;

final class PlaceAttributesValidator
{
    /**
     * Validates a place's attributes against its category's JSON Schema. Categories without a schema accept anything.
     *
     * @param  array<string, mixed>|null  $attributes
     *
     * @throws ValidationException With one readable message per violation, prefixed by the attribute path.
     */
    public function validate(Category $category, ?array $attributes): void
    {
        $schema = $category->attributes_schema;
        if (empty($schema)) {
            return;
        }

        $data = json_decode(json_encode($attributes ?? new \stdClass(), JSON_THROW_ON_ERROR), false, 512, JSON_THROW_ON_ERROR);
        if (is_array($data)) {
            $data = new \stdClass();
        }

        $result = (new Validator(max_errors: 25, stop_at_first_error: false))->validate($data, json_decode(json_encode($schema, JSON_THROW_ON_ERROR), false, 512, JSON_THROW_ON_ERROR));
        if ($result->isValid()) {
            return;
        }

        $messages = [];
        foreach ((new ErrorFormatter())->format($result->error(), false) as $path => $errors) {
            foreach ((array) $errors as $error) {
                $messages[] = ($path === '/' || $path === '' ? 'attributes' : ltrim((string) $path, '/')).': '.$error;
            }
        }

        throw ValidationException::withMessages(['attributes' => $messages]);
    }
}
