<?php

namespace App\Domain\Categories;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Translatable\HasTranslations;

class Category extends Model
{
    use HasFactory;
    use HasTranslations;

    /** @var list<string> */
    public array $translatable = ['name'];

    protected $guarded = [];

    protected static function newFactory(): CategoryFactory
    {
        return CategoryFactory::new();
    }

    protected function casts(): array
    {
        return ['kind' => CategoryKind::class, 'attributes_schema' => 'array'];
    }
}
