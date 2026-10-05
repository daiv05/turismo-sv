<?php

namespace App\Console\Commands;

use App\Domain\Tilesets\TileRebuild;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExportExclusions extends Command
{
    protected $signature = 'tilesets:exclusions {path : File to write the GeoJSON FeatureCollection to}';

    protected $description = 'Export the footprints of sites with an approved model so the pipeline can leave out generic buildings there';

    public function handle(): int
    {
        $rows = DB::select(<<<'SQL'
            select p.slug,
                   ST_AsGeoJSON(
                       coalesce(
                           p.footprint,
                           ST_Transform(
                               ST_SetSRID(ST_Expand(ST_Transform(p.location, 32616), greatest(
                                   coalesce((m.spec->'footprint'->>'w')::float, 40),
                                   coalesce((m.spec->'footprint'->>'d')::float, 40)
                               ) / 2), 32616),
                               4326
                           )
                       )
                   ) as geometry
            from places p
            join place_models m on m.id = p.current_model_id
            order by p.id
        SQL);

        $features = array_map(fn ($row) => [
            'type' => 'Feature',
            'properties' => ['slug' => $row->slug],
            'geometry' => json_decode($row->geometry, true),
        ], $rows);

        file_put_contents((string) $this->argument('path'), json_encode(['type' => 'FeatureCollection', 'features' => $features], JSON_THROW_ON_ERROR));

        $pending = TileRebuild::query()->where('status', 'pending')->count();
        $this->info(count($features).' footprint(s) exported, '.$pending.' pending rebuild(s).');
        $this->line('Build with EXCLUSIONS_FILE=<path>, publish, then run tilesets:register to close them.');

        return self::SUCCESS;
    }
}
