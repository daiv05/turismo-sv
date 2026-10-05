<?php

namespace App\Domain\Places;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlaceModel extends Model
{
    protected $table = 'place_models';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => ModelStatus::class,
            'spec' => 'array',
            'thumbnail_paths' => 'array',
            'reference_media' => 'array',
            'generation_log' => 'array',
        ];
    }

    public function place(): BelongsTo
    {
        return $this->belongsTo(Place::class);
    }
}
