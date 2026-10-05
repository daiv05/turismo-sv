<?php

namespace App\Events;

use App\Domain\Places\PlaceModel;
use Illuminate\Foundation\Events\Dispatchable;

class PlaceModelApproved
{
    use Dispatchable;

    public function __construct(public readonly PlaceModel $model) {}
}
