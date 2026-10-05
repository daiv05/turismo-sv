<?php

namespace App\Domain\Tilesets;

use Illuminate\Database\Eloquent\Model;

class TilesetVersion extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['regions' => 'array', 'is_current' => 'boolean', 'built_at' => 'datetime'];
    }

    public static function current(): ?self
    {
        return static::query()->where('is_current', true)->latest('built_at')->first();
    }
}
