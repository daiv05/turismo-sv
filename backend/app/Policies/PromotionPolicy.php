<?php

namespace App\Policies;

use App\Domain\Promotions\Promotion;
use App\Models\User;

class PromotionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'zone_admin']);
    }

    public function view(User $user, Promotion $promotion): bool
    {
        return $this->withinReach($user, $promotion);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'zone_admin']);
    }

    public function update(User $user, Promotion $promotion): bool
    {
        return $this->withinReach($user, $promotion);
    }

    public function publish(User $user, Promotion $promotion): bool
    {
        return $user->hasRole('super_admin');
    }

    public function delete(User $user, Promotion $promotion): bool
    {
        return $user->hasRole('super_admin');
    }

    private function withinReach(User $user, Promotion $promotion): bool
    {
        return Promotion::query()->visibleTo($user)->whereKey($promotion->getKey())->exists();
    }
}
