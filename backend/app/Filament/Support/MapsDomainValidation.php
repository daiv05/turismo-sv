<?php

namespace App\Filament\Support;

use Illuminate\Validation\ValidationException;

/**
 * Surfaces validation errors thrown by the domain layer on the matching form fields. Filament reads form errors
 * under the `data.` prefix, while the domain reports plain field names.
 */
trait MapsDomainValidation
{
    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     *
     * @throws ValidationException
     */
    protected function withFormErrors(callable $callback): mixed
    {
        try {
            return $callback();
        } catch (ValidationException $e) {
            throw ValidationException::withMessages(
                collect($e->errors())->mapWithKeys(fn (array $messages, string $key) => ["data.{$key}" => $messages])->all(),
            );
        }
    }
}
