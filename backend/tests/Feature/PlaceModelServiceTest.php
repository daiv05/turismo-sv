<?php

use App\Domain\Places\BuilderRejected;
use App\Domain\Places\BuilderUnavailable;
use App\Domain\Places\ModelStatus;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceModelService;
use App\Jobs\BuildPlaceModelJob;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    config(['services.builder.url' => 'http://builder.test', 'services.builder.token' => 'secret-token-123456', 'filesystems.default' => 's3']);
    Storage::fake('s3');
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
    $this->superAdmin = User::factory()->create()->assignRole('super_admin');
    $this->zoneAdmin = User::factory()->create()->assignRole('zone_admin');
    $this->place = Place::factory()->create();
    $this->service = app(PlaceModelService::class);
    $this->spec = ['kitVersion' => '1.0', 'footprint' => ['w' => 40, 'd' => 40], 'parts' => []];
});

function builderOk(): array
{
    return [
        'glb' => base64_encode('GLB-BYTES'),
        'triangles' => 1234,
        'spec' => ['kitVersion' => '1.0', 'footprint' => ['w' => 40, 'd' => 40], 'parts' => [['type' => 'hall']]],
        'thumbnails' => [base64_encode('PNG1'), base64_encode('PNG2'), base64_encode('PNG3')],
        'warnings' => [],
    ];
}

it('creates numbered versions in the queued state and dispatches the build', function () {
    Queue::fake();

    $first = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, 'Catedral con cúpula azul');
    $second = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin);

    expect([$first->version, $second->version])->toBe([1, 2])
        ->and($first->status)->toBe(ModelStatus::Queued)
        ->and($first->source)->toBe('kit')
        ->and($first->prompt)->toBe('Catedral con cúpula azul')
        ->and($first->created_by)->toBe($this->zoneAdmin->id);
    Queue::assertPushed(BuildPlaceModelJob::class, 2);
});

it('builds through the builder service, stores the files and leaves a draft', function () {
    Http::fake(['builder.test/build' => Http::response(builderOk())]);
    $model = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);

    $this->service->build($model);

    $model->refresh();
    expect($model->status)->toBe(ModelStatus::Draft)
        ->and($model->glb_path)->toBe("models/{$this->place->id}/v1/model.glb")
        ->and($model->thumbnail_paths)->toHaveCount(3)
        ->and($model->kit_version)->toBe('1.0')
        ->and($model->spec['parts'][0]['type'])->toBe('hall')
        ->and($model->generation_log['triangles'])->toBe(1234);
    Storage::disk('s3')->assertExists($model->glb_path);
    expect(Storage::disk('s3')->get($model->glb_path))->toBe('GLB-BYTES');
    Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer secret-token-123456') && $request['spec'] === $this->spec);
});

it('marks the version failed with readable reasons when the style rules reject it', function () {
    Http::fake(['builder.test/build' => Http::response([
        'error' => 'rules',
        'violations' => [['rule' => 'grounded', 'path' => 'parts[2]', 'message' => 'dome floats at y=40']],
    ], 422)]);
    $model = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);

    $this->service->build($model);

    $model->refresh();
    expect($model->status)->toBe(ModelStatus::Failed)
        ->and($model->failure_reason)->toContain('parts[2]')->toContain('dome floats at y=40')
        ->and($model->glb_path)->toBeNull();
});

it('leaves the version retryable when the builder is down', function () {
    Http::fake(['builder.test/build' => Http::response('unavailable', 503)]);
    $model = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);

    expect(fn () => $this->service->build($model))->toThrow(BuilderUnavailable::class);
    expect($model->fresh()->status)->toBe(ModelStatus::Queued);
});

it('treats a connection failure as the builder being down', function () {
    Http::fake(['builder.test/build' => fn () => throw new Illuminate\Http\Client\ConnectionException('refused')]);
    $model = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);

    expect(fn () => $this->service->build($model))->toThrow(BuilderUnavailable::class);
});

it('does not rebuild a version that is not queued', function () {
    Http::fake();
    $model = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);
    $model->update(['status' => ModelStatus::Approved]);

    $this->service->build($model);

    Http::assertNothingSent();
});

it('runs the build job and records a permanent failure after the retries are spent', function () {
    Http::fake(['builder.test/build' => Http::response('unavailable', 503)]);
    $model = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);
    $job = new BuildPlaceModelJob($model->id);

    expect($job->tries)->toBe(3)->and($job->backoff())->toBe([10, 60, 300]);
    $job->failed(new BuilderUnavailable('down'));

    expect($model->fresh()->status)->toBe(ModelStatus::Failed)
        ->and($model->fresh()->failure_reason)->toContain('builder');
});

it('lets only a super admin approve a draft and makes it the current model', function () {
    Http::fake(['builder.test/build' => Http::response(builderOk())]);
    $model = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);
    $this->service->build($model);

    expect(fn () => $this->service->approve($model->fresh(), $this->zoneAdmin))->toThrow(AuthorizationException::class);
    $this->service->approve($model->fresh(), $this->superAdmin, 'Se ve bien');

    $model->refresh();
    expect($model->status)->toBe(ModelStatus::Approved)
        ->and($model->reviewed_by)->toBe($this->superAdmin->id)
        ->and($model->review_notes)->toBe('Se ve bien')
        ->and($this->place->fresh()->current_model_id)->toBe($model->id);
});

it('only approves drafts', function () {
    $model = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);

    expect(fn () => $this->service->approve($model, $this->superAdmin))->toThrow(InvalidArgumentException::class);
});

it('rejects a draft with notes and keeps the current model untouched', function () {
    Http::fake(['builder.test/build' => Http::response(builderOk())]);
    $first = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);
    $this->service->build($first);
    $this->service->approve($first->fresh(), $this->superAdmin);
    $second = $this->service->createFromSpec($this->place, $this->spec, $this->zoneAdmin, dispatch: false);
    $this->service->build($second);

    $this->service->reject($second->fresh(), $this->superAdmin, 'La cúpula es muy grande');

    expect($second->fresh()->status)->toBe(ModelStatus::Rejected)
        ->and($second->fresh()->review_notes)->toBe('La cúpula es muy grande')
        ->and($this->place->fresh()->current_model_id)->toBe($first->id);
});

it('stores an uploaded glb after the builder normalizes it, only for super admins', function () {
    Http::fake(['builder.test/validate-upload' => Http::response(['glb' => base64_encode('NORMALIZED'), 'triangles' => 800, 'size' => ['x' => 10, 'y' => 5, 'z' => 10], 'roles' => ['neutral']])]);

    expect(fn () => $this->service->uploadGlb($this->place, 'RAW', $this->zoneAdmin))->toThrow(AuthorizationException::class);
    $model = $this->service->uploadGlb($this->place, 'RAW', $this->superAdmin);

    expect($model->source)->toBe('upload')->and($model->status)->toBe(ModelStatus::Draft)->and($model->spec)->toBeNull();
    expect(Storage::disk('s3')->get($model->glb_path))->toBe('NORMALIZED');
});

it('surfaces upload rejections with the builder message', function () {
    Http::fake(['builder.test/validate-upload' => Http::response(['code' => 'budget', 'message' => 'The model has 20000 triangles'], 422)]);

    expect(fn () => $this->service->uploadGlb($this->place, 'RAW', $this->superAdmin))->toThrow(BuilderRejected::class, 'The model has 20000 triangles');
});
