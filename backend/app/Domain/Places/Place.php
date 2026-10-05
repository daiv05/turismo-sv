<?php

namespace App\Domain\Places;

use App\Domain\Categories\Category;
use App\Domain\Promotions\Promotion;
use App\Domain\Zones\Zone;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Database\Factories\PlaceFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Spatie\Translatable\HasTranslations;

class Place extends Model
{
    use HasFactory;
    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['name', 'summary', 'description'];

    protected $guarded = [];

    protected static function newFactory(): PlaceFactory
    {
        return PlaceFactory::new();
    }

    protected $hidden = ['location', 'footprint'];

    protected function casts(): array
    {
        return [
            'status' => PlaceStatus::class,
            'attributes' => 'array',
            'opening_hours' => 'array',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function models(): HasMany
    {
        return $this->hasMany(PlaceModel::class);
    }

    public function currentModel(): BelongsTo
    {
        return $this->belongsTo(PlaceModel::class, 'current_model_id');
    }

    public function promotions(): HasMany
    {
        return $this->hasMany(Promotion::class);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('places.status', PlaceStatus::Published->value);
    }

    /**
     * Adds `lon` and `lat` columns extracted from the point geometry.
     */
    public function scopeWithCoordinates(Builder $query): Builder
    {
        return $query
            ->addSelect('places.*')
            ->addSelect(DB::raw('ST_X(places.location) as lon'), DB::raw('ST_Y(places.location) as lat'));
    }

    /**
     * Restricts places to those whose location lies within a zone the user administers. Super admins see everything.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole('super_admin')) {
            return $query;
        }

        return $query->whereExists(function ($sub) use ($user) {
            $sub->selectRaw('1')
                ->from('zones')
                ->join('zone_user', 'zone_user.zone_id', '=', 'zones.id')
                ->where('zone_user.user_id', $user->getKey())
                ->whereRaw('ST_Within(places.location, zones.boundary)');
        });
    }
}
