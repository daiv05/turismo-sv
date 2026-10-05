<?php

namespace Database\Factories;

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Support\Spatial;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Place> */
class PlaceFactory extends Factory
{
    protected $model = Place::class;

    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'category_id' => Category::factory(),
            'name' => ['es' => $name, 'en' => $name],
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 99999),
            'summary' => ['es' => 'Resumen', 'en' => 'Summary'],
            'location' => Spatial::point(-89.19, 13.70),
            'status' => PlaceStatus::Published,
            'priority' => 0,
        ];
    }

    public function at(float $lon, float $lat): static
    {
        return $this->state(['location' => Spatial::point($lon, $lat)]);
    }

    public function status(PlaceStatus $status): static
    {
        return $this->state(['status' => $status]);
    }
}
