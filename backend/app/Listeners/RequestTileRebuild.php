<?php

namespace App\Listeners;

use App\Domain\Tilesets\TileRebuild;
use App\Events\PlaceModelApproved;

class RequestTileRebuild
{
    /**
     * Notes that the tiles around the site must be rebuilt without its generic buildings, once per pending request.
     */
    public function handle(PlaceModelApproved $event): void
    {
        TileRebuild::query()->firstOrCreate(['place_id' => $event->model->place_id, 'status' => 'pending']);
    }
}
