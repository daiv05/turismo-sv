<?php

namespace App\Support;

use Opis\JsonSchema\Validator;
use Throwable;

final class JsonSchemaCheck
{
    /**
     * Explains why a string is not a usable JSON Schema object, or returns null when it is.
     */
    public static function problem(string $json): ?string
    {
        $decoded = json_decode($json);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return 'Not valid JSON: '.json_last_error_msg();
        }
        if (! $decoded instanceof \stdClass) {
            return 'A JSON Schema must be a JSON object.';
        }

        try {
            (new Validator())->validate(new \stdClass(), $decoded);
        } catch (Throwable $e) {
            return 'Not a valid JSON Schema: '.$e->getMessage();
        }

        return null;
    }
}
