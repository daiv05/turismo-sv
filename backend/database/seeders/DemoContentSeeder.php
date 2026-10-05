<?php

namespace Database\Seeders;

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Zones\Zone;
use App\Domain\Zones\ZoneType;
use App\Support\Spatial;
use Illuminate\Database\Seeder;

class DemoContentSeeder extends Seeder
{
    public function run(): void
    {
        $country = $this->zone('el-salvador', 'El Salvador', 'El Salvador', ZoneType::Country, null, [-90.2, 13.1, -87.6, 14.5], ['lon' => -88.9, 'lat' => 13.75, 'distance' => 450000]);
        $department = $this->zone('san-salvador', 'San Salvador', 'San Salvador', ZoneType::Department, $country, [-89.35, 13.6, -89.05, 13.85], ['lon' => -89.2, 'lat' => 13.7, 'distance' => 30000]);
        $center = $this->zone('centro-historico', 'Centro Histórico', 'Historic Center', ZoneType::TouristDistrict, $department, [-89.205, 13.690, -89.180, 13.708], ['lon' => -89.1915, 'lat' => 13.6988, 'distance' => 1500]);

        $monuments = Category::where('slug', 'monuments')->firstOrFail();

        $places = [
            ['catedral-metropolitana', 'Catedral Metropolitana', 'Metropolitan Cathedral', 'Sede de la arquidiócesis de San Salvador, frente a la Plaza Barrios.', 'Seat of the Archdiocese of San Salvador, facing Plaza Barrios.', -89.19147, 13.69888, 100],
            ['palacio-nacional', 'Palacio Nacional', 'National Palace', 'Edificio histórico de estilo neoclásico en el corazón del centro.', 'Historic neoclassical building in the heart of downtown.', -89.19223, 13.69867, 90],
            ['teatro-nacional', 'Teatro Nacional', 'National Theatre', 'Teatro de inicios del siglo XX con fachada ornamentada.', 'Early twentieth century theatre with an ornate facade.', -89.19270, 13.69810, 80],
            ['iglesia-el-rosario', 'Iglesia El Rosario', 'El Rosario Church', 'Iglesia de arquitectura moderna conocida por su interior de vitrales.', 'Church of modern architecture known for its stained glass interior.', -89.18783, 13.69985, 70],
            ['plaza-libertad', 'Plaza Libertad', 'Liberty Square', 'Plaza con el monumento a la Libertad en la avenida Cuscatlán.', 'Square with the Liberty monument on Cuscatlán avenue.', -89.18988, 13.69916, 60],
        ];

        foreach ($places as [$slug, $es, $en, $summaryEs, $summaryEn, $lon, $lat, $priority]) {
            Place::updateOrCreate(['slug' => $slug], [
                'category_id' => $monuments->id,
                'zone_id' => $center->id,
                'name' => ['es' => $es, 'en' => $en],
                'summary' => ['es' => $summaryEs, 'en' => $summaryEn],
                'location' => Spatial::point($lon, $lat),
                'status' => PlaceStatus::Published,
                'priority' => $priority,
            ]);
        }
    }

    /**
     * @param  array{0: float, 1: float, 2: float, 3: float}  $box  minLon, minLat, maxLon, maxLat
     * @param  array<string, float|int>  $camera
     */
    private function zone(string $slug, string $es, string $en, ZoneType $type, ?Zone $parent, array $box, array $camera): Zone
    {
        [$minLon, $minLat, $maxLon, $maxLat] = $box;

        return Zone::updateOrCreate(['slug' => $slug], [
            'name' => ['es' => $es, 'en' => $en],
            'type' => $type,
            'parent_id' => $parent?->id,
            'camera' => $camera,
            'boundary' => Spatial::fromGeoJson([
                'type' => 'Polygon',
                'coordinates' => [[[$minLon, $minLat], [$maxLon, $minLat], [$maxLon, $maxLat], [$minLon, $maxLat], [$minLon, $minLat]]],
            ], multi: true),
        ]);
    }
}
