<?php

namespace Database\Factories;

use App\Domain\Zones\Zone;
use App\Domain\Zones\ZoneType;
use App\Support\Spatial;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Zone> */
class ZoneFactory extends Factory
{
    protected $model = Zone::class;

    public function definition(): array
    {
        $name = fake()->unique()->city();

        return [
            'name' => ['es' => $name, 'en' => $name],
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 99999),
            'type' => ZoneType::Municipality,
            'boundary' => $this->box(-89.3, 13.6, -89.1, 13.8),
        ];
    }

    /**
     * Gives the zone a rectangular boundary in WGS84 degrees.
     */
    public function bounds(float $minLon, float $minLat, float $maxLon, float $maxLat): static
    {
        return $this->state(['boundary' => $this->box($minLon, $minLat, $maxLon, $maxLat)]);
    }

    private function box(float $minLon, float $minLat, float $maxLon, float $maxLat)
    {
        return Spatial::fromGeoJson([
            'type' => 'MultiPolygon',
            'coordinates' => [[[[$minLon, $minLat], [$maxLon, $minLat], [$maxLon, $maxLat], [$minLon, $maxLat], [$minLon, $minLat]]]],
        ]);
    }
}
