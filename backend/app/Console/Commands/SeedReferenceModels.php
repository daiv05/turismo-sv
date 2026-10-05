<?php

namespace App\Console\Commands;

use App\Domain\Places\BuilderRejected;
use App\Domain\Places\BuilderUnavailable;
use App\Domain\Places\ModelStatus;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceModelService;
use App\Models\User;
use Illuminate\Console\Command;

class SeedReferenceModels extends Command
{
    protected $signature = 'models:seed-reference {--path=../kit/models : Folder with one <place-slug>.json kit document per place} {--as= : Email of the super admin who approves the models}';

    protected $description = 'Build and approve the reference 3D models of the kit for the places they belong to';

    public function handle(PlaceModelService $service): int
    {
        $reviewer = User::where('email', $this->option('as'))->first();
        if (! $reviewer?->hasRole('super_admin')) {
            $this->error('--as must be the email of an existing super admin.');

            return self::FAILURE;
        }

        $files = glob(rtrim((string) $this->option('path'), '/').'/*.json') ?: [];
        if ($files === []) {
            $this->error('No kit documents found in '.$this->option('path'));

            return self::FAILURE;
        }

        foreach ($files as $file) {
            $slug = basename($file, '.json');
            $place = Place::where('slug', $slug)->first();
            if (! $place) {
                $this->warn("Skipping {$slug}: no place with that slug.");

                continue;
            }
            if ($place->models()->where('source', 'kit')->where('status', ModelStatus::Approved)->exists()) {
                $this->line("{$slug}: already has an approved model.");

                continue;
            }

            $spec = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            $model = $service->createFromSpec($place, $spec, $reviewer, 'Reference model', dispatch: false);
            try {
                $service->build($model);
            } catch (BuilderUnavailable $e) {
                $this->error("{$slug}: the builder service is unavailable ({$e->getMessage()}).");

                return self::FAILURE;
            }
            $model->refresh();
            if ($model->status !== ModelStatus::Draft) {
                $this->error("{$slug}: {$model->failure_reason}");

                return self::FAILURE;
            }
            $service->approve($model, $reviewer, 'Reference model of the kit');
            $this->info("{$slug}: model v{$model->version} approved ({$model->generation_log['triangles']} triangles).");
        }

        return self::SUCCESS;
    }
}
