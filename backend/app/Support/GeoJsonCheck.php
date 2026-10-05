<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Throwable;

final class GeoJsonCheck
{
    /**
     * Explains why a string is not a valid Polygon or MultiPolygon in WGS84, or returns null when it is.
     */
    public static function problem(string $json): ?string
    {
        $decoded = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded)) {
            return 'Not valid JSON.';
        }
        if (! in_array($decoded['type'] ?? null, ['Polygon', 'MultiPolygon'], true)) {
            return 'The geometry must be a Polygon or a MultiPolygon.';
        }

        $bad = false;
        $coordinates = $decoded['coordinates'] ?? [];
        array_walk_recursive($coordinates, function ($n) use (&$bad) {
            if (! is_numeric($n)) {
                $bad = true;
            }
        });
        if ($bad) {
            return 'Coordinates must be numbers.';
        }

        try {
            $row = DB::selectOne(
                'select ST_IsValid(g) as ok, ST_XMin(g) as x0, ST_XMax(g) as x1, ST_YMin(g) as y0, ST_YMax(g) as y1 '
                .'from (select ST_SetSRID(ST_GeomFromGeoJSON(?), 4326) as g) t',
                [$json],
            );
        } catch (Throwable) {
            return 'The geometry could not be read.';
        }

        if (! $row->ok) {
            return 'The geometry is not valid (self-intersections or unclosed rings).';
        }
        if ($row->x0 < -180 || $row->x1 > 180 || $row->y0 < -90 || $row->y1 > 90) {
            return 'Coordinates must be longitude/latitude in degrees.';
        }

        return null;
    }
}
