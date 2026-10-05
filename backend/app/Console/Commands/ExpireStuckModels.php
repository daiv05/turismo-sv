<?php

namespace App\Console\Commands;

use App\Domain\Places\ModelStatus;
use App\Domain\Places\PlaceModel;
use Illuminate\Console\Command;

class ExpireStuckModels extends Command
{
    protected $signature = 'models:expire-stuck {--minutes=30 : Minutes a generation may take before it is given up}';

    protected $description = 'Mark generations whose callback never arrived as failed';

    public function handle(): int
    {
        $count = PlaceModel::query()
            ->where('status', ModelStatus::Generating->value)
            ->where('updated_at', '<', now()->subMinutes((int) $this->option('minutes')))
            ->update([
                'status' => ModelStatus::Failed->value,
                'failure_reason' => 'The builder did not report back in time. Try again.',
            ]);

        $this->info("Expired {$count} generation(s).");

        return self::SUCCESS;
    }
}
