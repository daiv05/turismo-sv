<?php

namespace App\Domain\Tilesets;

use App\Domain\Places\Place;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A request to regenerate the terrain tiles around a site whose footprint changed because a 3D model was approved.
 * Rows stay pending until a tileset built afterwards is registered.
 */
class TileRebuild extends Model
{
    protected $guarded = [];

    public function place(): BelongsTo
    {
        return $this->belongsTo(Place::class);
    }
}
