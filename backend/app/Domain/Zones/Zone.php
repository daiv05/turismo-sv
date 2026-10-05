<?php

namespace App\Domain\Zones;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Database\Factories\ZoneFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Translatable\HasTranslations;

class Zone extends Model
{
    use HasFactory;
    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['name'];

    protected $guarded = [];

    protected static function newFactory(): ZoneFactory
    {
        return ZoneFactory::new();
    }

    protected $hidden = ['boundary'];

    protected function casts(): array
    {
        return ['type' => ZoneType::class, 'camera' => 'array'];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'zone_user');
    }
}
