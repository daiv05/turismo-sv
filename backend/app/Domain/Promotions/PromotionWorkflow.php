<?php

namespace App\Domain\Promotions;

use App\Domain\Places\PlaceStatus;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

/**
 * Draft, review and publication rules for promotions, mirroring the rules of places: zone admins prepare content in
 * their zones and only super admins publish.
 */
final class PromotionWorkflow
{
    public function submitForReview(Promotion $promotion, User $user): void
    {
        $this->authorize($user, 'update', $promotion);
        $this->require($promotion, PlaceStatus::Draft, 'Only drafts can be submitted for review');
        $promotion->update(['status' => PlaceStatus::InReview]);
    }

    public function approve(Promotion $promotion, User $user): void
    {
        $this->authorize($user, 'publish', $promotion);
        $this->require($promotion, PlaceStatus::InReview, 'Only promotions in review can be approved');
        $promotion->update(['status' => PlaceStatus::Published]);
    }

    public function reject(Promotion $promotion, User $user): void
    {
        $this->authorize($user, 'publish', $promotion);
        $this->require($promotion, PlaceStatus::InReview, 'Only promotions in review can be rejected');
        $promotion->update(['status' => PlaceStatus::Draft]);
    }

    /** Edits by zone admins withdraw a published promotion into review. */
    public function recordEditBy(Promotion $promotion, User $user): void
    {
        if (! $user->hasRole('super_admin') && $promotion->status === PlaceStatus::Published) {
            $promotion->update(['status' => PlaceStatus::InReview]);
        }
    }

    private function authorize(User $user, string $ability, Promotion $promotion): void
    {
        if (! Gate::forUser($user)->allows($ability, $promotion)) {
            throw new AuthorizationException("The user cannot {$ability} this promotion");
        }
    }

    private function require(Promotion $promotion, PlaceStatus $status, string $message): void
    {
        if ($promotion->status !== $status) {
            throw new InvalidArgumentException($message);
        }
    }
}
