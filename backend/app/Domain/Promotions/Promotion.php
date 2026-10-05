<?php

namespace App\Domain\Promotions;

use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Translatable\HasTranslations;

class Promotion extends Model
{
    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['title', 'body'];

    protected $guarded = [];

    protected static function booted(): void
    {
        static::saving(fn (self $promotion) => (new PromotionValidator())->validate($promotion));
    }

    protected function casts(): array
    {
        return [
            'status' => PlaceStatus::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'template_data' => 'array',
        ];
    }

    public function place(): BelongsTo
    {
        return $this->belongsTo(Place::class);
    }

    /**
     * Restricts promotions to those of places the user can reach. Super admins see everything.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole('super_admin')) {
            return $query;
        }

        return $query->whereIn('promotions.place_id', Place::query()->visibleTo($user)->select('places.id'));
    }

    /**
     * Published promotions whose window includes now: `starts_at <= now < ends_at`.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->where('promotions.status', PlaceStatus::Published->value)
            ->where('promotions.starts_at', '<=', now())
            ->where('promotions.ends_at', '>', now());
    }
}
