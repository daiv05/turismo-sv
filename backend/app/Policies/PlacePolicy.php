<?php

namespace App\Policies;

use App\Domain\Places\Place;
use App\Models\User;

class PlacePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'zone_admin']);
    }

    public function view(User $user, Place $place): bool
    {
        return $this->withinReach($user, $place);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'zone_admin']);
    }

    public function update(User $user, Place $place): bool
    {
        return $this->withinReach($user, $place);
    }

    public function publish(User $user, Place $place): bool
    {
        return $user->hasRole('super_admin');
    }

    public function delete(User $user, Place $place): bool
    {
        return $user->hasRole('super_admin');
    }

    private function withinReach(User $user, Place $place): bool
    {
        return Place::query()->visibleTo($user)->whereKey($place->getKey())->exists();
    }
}
