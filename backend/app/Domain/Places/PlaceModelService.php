<?php

namespace App\Domain\Places;

use App\Events\PlaceModelApproved;
use App\Jobs\BuildPlaceModelJob;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;

/**
 * Life cycle of the 3D model versions of a place: queued, generating, draft, then approved or rejected by a
 * super admin. Approving a version makes it the one visitors see.
 */
final class PlaceModelService
{
    public function __construct(private readonly BuilderClient $builder) {}

    /**
     * Registers a new version from a kit document and queues its build.
     *
     * @param  array<string, mixed>  $spec
     */
    public function createFromSpec(Place $place, array $spec, User $creator, ?string $prompt = null, bool $dispatch = true): PlaceModel
    {
        $model = $this->newVersion($place, $creator, [
            'source' => 'kit',
            'spec' => $spec,
            'prompt' => $prompt,
            'status' => ModelStatus::Queued,
        ]);

        if ($dispatch) {
            BuildPlaceModelJob::dispatch($model->id);
        }

        return $model;
    }

    /**
     * Builds a queued version through the builder service and leaves it as a draft, or as failed when the style
     * rules reject it. Builder outages are rethrown so the job can retry.
     *
     * @throws BuilderUnavailable
     */
    public function build(PlaceModel $model): void
    {
        if ($model->status !== ModelStatus::Queued) {
            return;
        }

        $model->update(['status' => ModelStatus::Generating]);
        $started = microtime(true);

        try {
            $result = $this->builder->build($model->spec ?? []);
        } catch (BuilderRejected $e) {
            $model->update(['status' => ModelStatus::Failed, 'failure_reason' => $e->getMessage()]);

            return;
        } catch (BuilderUnavailable $e) {
            $model->update(['status' => ModelStatus::Queued]);
            throw $e;
        }

        $directory = "models/{$model->place_id}/v{$model->version}";
        $disk = $this->disk();
        $disk->put("{$directory}/model.glb", base64_decode($result['glb'], true) ?: '');
        $thumbnails = [];
        foreach (array_values($result['thumbnails'] ?? []) as $i => $image) {
            $path = "{$directory}/thumb-".($i + 1).'.png';
            $disk->put($path, base64_decode($image, true) ?: '');
            $thumbnails[] = $path;
        }

        $model->update([
            'status' => ModelStatus::Draft,
            'glb_path' => "{$directory}/model.glb",
            'thumbnail_paths' => $thumbnails,
            'kit_version' => $result['spec']['kitVersion'] ?? null,
            'spec' => $result['spec'] ?? $model->spec,
            'failure_reason' => null,
            'generation_log' => [
                'triangles' => $result['triangles'],
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
                'warnings' => $result['warnings'] ?? [],
            ],
        ]);
    }

    /**
     * Stores an externally modeled glb after the builder brought it into the style. Super admins only.
     *
     * @param  array{w: float, d: float}|null  $footprint
     *
     * @throws AuthorizationException
     * @throws BuilderRejected
     * @throws BuilderUnavailable
     */
    public function uploadGlb(Place $place, string $glbBinary, User $uploader, ?array $footprint = null): PlaceModel
    {
        $this->requireSuperAdmin($uploader);
        $result = $this->builder->validateUpload($glbBinary, $footprint);

        $model = $this->newVersion($place, $uploader, ['source' => 'upload', 'status' => ModelStatus::Draft]);
        $path = "models/{$place->id}/v{$model->version}/model.glb";
        $this->disk()->put($path, base64_decode($result['glb'], true) ?: '');
        $model->update([
            'glb_path' => $path,
            'generation_log' => ['triangles' => $result['triangles'], 'size' => $result['size'], 'roles' => $result['roles']],
        ]);

        return $model;
    }

    /**
     * @throws AuthorizationException When the reviewer is not a super admin.
     * @throws InvalidArgumentException When the version is not a draft.
     */
    public function approve(PlaceModel $model, User $reviewer, ?string $notes = null): void
    {
        $this->requireSuperAdmin($reviewer);
        $this->requireDraft($model, 'approved');

        DB::transaction(function () use ($model, $reviewer, $notes) {
            $model->update(['status' => ModelStatus::Approved, 'reviewed_by' => $reviewer->id, 'review_notes' => $notes]);
            $model->place()->update(['current_model_id' => $model->id]);
        });

        PlaceModelApproved::dispatch($model);
    }

    /**
     * @throws AuthorizationException When the reviewer is not a super admin.
     * @throws InvalidArgumentException When the version is not a draft.
     */
    public function reject(PlaceModel $model, User $reviewer, ?string $notes = null): void
    {
        $this->requireSuperAdmin($reviewer);
        $this->requireDraft($model, 'rejected');

        $model->update(['status' => ModelStatus::Rejected, 'reviewed_by' => $reviewer->id, 'review_notes' => $notes]);
    }

    /** @param  array<string, mixed>  $attributes */
    private function newVersion(Place $place, User $creator, array $attributes): PlaceModel
    {
        return DB::transaction(function () use ($place, $creator, $attributes) {
            Place::query()->whereKey($place->getKey())->lockForUpdate()->first();
            $version = (int) PlaceModel::query()->where('place_id', $place->id)->max('version') + 1;

            return PlaceModel::create($attributes + ['place_id' => $place->id, 'version' => $version, 'created_by' => $creator->id]);
        });
    }

    private function requireSuperAdmin(User $user): void
    {
        if (! $user->hasRole('super_admin')) {
            throw new AuthorizationException('Only a super admin can do this.');
        }
    }

    private function requireDraft(PlaceModel $model, string $verb): void
    {
        if ($model->status !== ModelStatus::Draft) {
            throw new InvalidArgumentException("Only drafts can be {$verb}.");
        }
    }

    private function disk(): \Illuminate\Contracts\Filesystem\Filesystem
    {
        return Storage::disk(config('filesystems.default'));
    }
}
