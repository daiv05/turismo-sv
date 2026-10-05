<?php

namespace App\Console\Commands;

use App\Domain\Tilesets\TilesetVersion;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ActivateTileset extends Command
{
    protected $signature = 'tilesets:activate {version}';

    protected $description = 'Make an already registered tileset version the current one, for example to roll back';

    public function handle(): int
    {
        $version = TilesetVersion::where('version', $this->argument('version'))->first();
        if (! $version) {
            $this->error("Unknown tileset version {$this->argument('version')}.");

            return self::FAILURE;
        }

        DB::transaction(function () use ($version) {
            TilesetVersion::query()->where('id', '!=', $version->id)->update(['is_current' => false]);
            $version->update(['is_current' => true]);
        });
        $this->info("Tileset {$version->version} is now current.");

        return self::SUCCESS;
    }
}
