<?php

namespace App\Support;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class Spatial
{
    /**
     * Builds a WGS84 point expression from longitude and latitude.
     *
     * @throws InvalidArgumentException When the coordinates are not finite or fall outside valid ranges.
     */
    public static function point(float $lon, float $lat): Expression
    {
        if (! is_finite($lon) || ! is_finite($lat) || abs($lon) > 180 || abs($lat) > 90) {
            throw new InvalidArgumentException("Invalid coordinates lon={$lon} lat={$lat}");
        }

        return DB::raw(sprintf('ST_SetSRID(ST_MakePoint(%F, %F), 4326)', $lon, $lat));
    }

    /**
     * Builds a WGS84 geometry expression from a GeoJSON geometry array, binding nothing from user input unescaped.
     *
     * @param  array<string, mixed>  $geometry
     */
    public static function fromGeoJson(array $geometry): Expression
    {
        $json = json_encode($geometry, JSON_THROW_ON_ERROR);

        return DB::raw('ST_SetSRID(ST_GeomFromGeoJSON('.DB::getPdo()->quote($json).'), 4326)');
    }
}
