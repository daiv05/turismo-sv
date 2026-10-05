<?php

namespace App\Jobs;

use App\Domain\Places\ModelStatus;
use App\Domain\Places\PlaceModel;
use App\Domain\Places\PlaceModelService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class BuildPlaceModelJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly int $modelId) {}

    /** @return list<int> */
    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(PlaceModelService $service): void
    {
        if ($model = PlaceModel::find($this->modelId)) {
            $service->build($model);
        }
    }

    public function failed(Throwable $exception): void
    {
        $model = PlaceModel::find($this->modelId);
        if ($model && in_array($model->status, [ModelStatus::Queued, ModelStatus::Generating], true)) {
            $model->update([
                'status' => ModelStatus::Failed,
                'failure_reason' => 'The builder service did not respond after several attempts. Try again later.',
            ]);
        }
    }
}
