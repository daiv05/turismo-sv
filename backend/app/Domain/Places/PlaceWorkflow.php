<?php

namespace App\Domain\Places;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

/**
 * Draft, review and publication rules for places. Zone admins can only prepare content inside their zones;
 * only super admins publish.
 */
final class PlaceWorkflow
{
    /**
     * @throws AuthorizationException When the user cannot edit the place.
     * @throws InvalidArgumentException When the place is not a draft.
     */
    public function submitForReview(Place $place, User $user): void
    {
        $this->authorize($user, 'update', $place);
        if ($place->status !== PlaceStatus::Draft) {
            throw new InvalidArgumentException('Only drafts can be submitted for review');
        }
        $place->update(['status' => PlaceStatus::InReview]);
    }

    /**
     * @throws AuthorizationException When the user cannot publish.
     * @throws InvalidArgumentException When the place is not in review.
     */
    public function approve(Place $place, User $user): void
    {
        $this->authorize($user, 'publish', $place);
        if ($place->status !== PlaceStatus::InReview) {
            throw new InvalidArgumentException('Only places in review can be approved');
        }
        $place->update(['status' => PlaceStatus::Published]);
    }

    /**
     * @throws AuthorizationException When the user cannot publish.
     * @throws InvalidArgumentException When the place is not in review.
     */
    public function reject(Place $place, User $user): void
    {
        $this->authorize($user, 'publish', $place);
        if ($place->status !== PlaceStatus::InReview) {
            throw new InvalidArgumentException('Only places in review can be rejected');
        }
        $place->update(['status' => PlaceStatus::Draft]);
    }

    /**
     * Call after a user saved changes to a place. Edits by zone admins withdraw a published place into review.
     */
    public function recordEditBy(Place $place, User $user): void
    {
        if (! $user->hasRole('super_admin') && $place->status === PlaceStatus::Published) {
            $place->update(['status' => PlaceStatus::InReview]);
        }
    }

    /**
     * Whether the user may put a place at these WGS84 coordinates.
     */
    public function canPlaceAt(User $user, float $lon, float $lat): bool
    {
        if ($user->hasRole('super_admin')) {
            return true;
        }

        return $user->zones()
            ->whereRaw('ST_Within(ST_SetSRID(ST_MakePoint(?, ?), 4326), zones.boundary)', [$lon, $lat])
            ->exists();
    }

    private function authorize(User $user, string $ability, Place $place): void
    {
        if (! Gate::forUser($user)->allows($ability, $place)) {
            throw new AuthorizationException("The user cannot {$ability} this place");
        }
    }
}
