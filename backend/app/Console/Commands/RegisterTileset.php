<?php

namespace App\Console\Commands;

use App\Domain\Tilesets\TileRebuild;
use App\Domain\Tilesets\TilesetVersion;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RegisterTileset extends Command
{
    protected $signature = 'tilesets:register {version} {base_url : Public folder that contains tileset.json} {--regions=* : Regions the build covers} {--no-activate : Register without making it current}';

    protected $description = 'Register a published tileset version and make it the one visitors load';

    public function handle(): int
    {
        $base = (string) $this->argument('base_url');
        if (! preg_match('#^https?://#i', $base)) {
            $this->error('The base URL must start with http:// or https://.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($base) {
            $version = TilesetVersion::updateOrCreate(['version' => (string) $this->argument('version')], [
                'base_url' => rtrim($base, '/').'/',
                'regions' => $this->option('regions') ?: null,
                'built_at' => now(),
            ]);
            if (! $this->option('no-activate')) {
                $this->switchTo($version);
                TileRebuild::query()->where('status', 'pending')->update(['status' => 'done']);
            }
        });

        $this->info("Tileset {$this->argument('version')} registered.");

        return self::SUCCESS;
    }

    private function switchTo(TilesetVersion $version): void
    {
        TilesetVersion::query()->where('id', '!=', $version->id)->update(['is_current' => false]);
        $version->update(['is_current' => true]);
    }
}
