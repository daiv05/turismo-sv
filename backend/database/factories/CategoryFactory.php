<?php

namespace Database\Factories;

use App\Domain\Categories\Category;
use App\Domain\Categories\CategoryKind;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Category> */
class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        $name = fake()->unique()->word();

        return [
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 99999),
            'name' => ['es' => $name, 'en' => $name],
            'icon' => 'landmark',
            'color_token' => 'accent',
            'kind' => CategoryKind::Attraction,
            'min_zoom' => 0,
            'sort' => 0,
        ];
    }
}
