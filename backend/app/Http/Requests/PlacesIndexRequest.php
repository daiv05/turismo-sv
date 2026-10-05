<?php

namespace App\Http\Requests;

use App\Support\CellGrid;
use Illuminate\Foundation\Http\FormRequest;
use InvalidArgumentException;

class PlacesIndexRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'cell' => ['required', 'string', function (string $attribute, mixed $value, \Closure $fail) {
                try {
                    CellGrid::parse((string) $value);
                } catch (InvalidArgumentException $e) {
                    $fail($e->getMessage());
                }
            }],
            'categories' => ['nullable', 'string', 'max:500'],
            'locale' => ['nullable', 'in:es,en'],
        ];
    }

    public function cell(): CellGrid
    {
        return CellGrid::parse($this->validated('cell'));
    }

    /** @return list<string> */
    public function categorySlugs(): array
    {
        $raw = (string) ($this->validated('categories') ?? '');

        return array_values(array_filter(array_map('trim', explode(',', $raw))));
    }
}
