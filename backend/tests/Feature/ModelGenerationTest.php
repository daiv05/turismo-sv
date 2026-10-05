<?php

use App\Domain\Places\BuilderRejected;
use App\Domain\Places\BuilderUnavailable;
use App\Domain\Places\ModelStatus;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceModelService;
use App\Jobs\RequestGenerationJob;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    config([
        'services.builder.url' => 'http://builder.test',
        'services.builder.token' => 'secret-token-123456',
        'services.builder.callback_base' => 'http://php.test',
        'filesystems.default' => 's3',
        'llm.pricing' => null,
    ]);
    Storage::fake('s3');
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
    $this->user = User::factory()->create()->assignRole('zone_admin');
    $this->place = Place::factory()->create();
    $this->service = app(PlaceModelService::class);
});

function completion(array $over = []): array
{
    return array_merge([
        'jobId' => 0,
        'status' => 'ok',
        'spec' => ['kitVersion' => '1.0', 'parts' => [['type' => 'hall']]],
        'glb' => base64_encode('GLB'),
        'triangles' => 900,
        'thumbnails' => [base64_encode('P1')],
        'log' => [
            'iterations' => [['kind' => 'generate', 'violations' => 1], ['kind' => 'fix', 'violations' => 0]],
            'usage' => ['inputTokens' => 12000, 'outputTokens' => 3000, 'cacheReadTokens' => 4000, 'cacheWriteTokens' => 0],
            'notes' => [],
        ],
    ], $over);
}

function callback($test, $model, array $payload, string $token = 'secret-token-123456')
{
    return $test->postJson("/api/internal/models/{$model->id}/callback", $payload, ['Authorization' => "Bearer {$token}"]);
}

it('queues a generation from a description with reference photos', function () {
    Queue::fake();

    $model = $this->service->requestGeneration($this->place, 'Iglesia con cúpula azul', ['https://cdn.test/a.jpg'], $this->user);

    expect($model->status)->toBe(ModelStatus::Queued)->and($model->source)->toBe('kit')->and($model->spec)->toBeNull()
        ->and($model->prompt)->toBe('Iglesia con cúpula azul')->and($model->reference_media)->toBe(['https://cdn.test/a.jpg']);
    Queue::assertPushed(RequestGenerationJob::class);
});

it('asks the builder to generate and waits for the callback', function () {
    Http::fake(['builder.test/generate' => Http::response(['accepted' => true], 202)]);
    $model = $this->service->requestGeneration($this->place, 'Iglesia', ['https://cdn.test/a.jpg'], $this->user, dispatch: false);

    $this->service->dispatchGeneration($model);

    expect($model->fresh()->status)->toBe(ModelStatus::Generating);
    Http::assertSent(fn ($r) => $r->url() === 'http://builder.test/generate'
        && $r['jobId'] === $model->id
        && $r['description'] === 'Iglesia'
        && $r['referenceUrls'] === ['https://cdn.test/a.jpg']
        && $r['callbackUrl'] === "http://php.test/api/internal/models/{$model->id}/callback"
        && $r['footprint'] === ['w' => 40, 'd' => 40]);
});

it('uses the footprint of the place as the plot size when it has one', function () {
    DB::statement("update places set footprint = ST_SetSRID(ST_GeomFromText('POLYGON((-89.1915 13.6988, -89.1905 13.6988, -89.1905 13.6993, -89.1915 13.6993, -89.1915 13.6988))'), 4326) where id = ?", [$this->place->id]);
    Http::fake(['builder.test/generate' => Http::response(['accepted' => true], 202)]);
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);

    $this->service->dispatchGeneration($model);

    Http::assertSent(function ($r) {
        return $r['footprint']['w'] > 90 && $r['footprint']['w'] < 120 && $r['footprint']['d'] > 45 && $r['footprint']['d'] < 65;
    });
});

it('returns to the queue when the builder is down so the job can retry', function () {
    Http::fake(['builder.test/generate' => Http::response('', 503)]);
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);

    expect(fn () => $this->service->dispatchGeneration($model))->toThrow(BuilderUnavailable::class);
    expect($model->fresh()->status)->toBe(ModelStatus::Queued);
});

it('fails the version when the builder rejects the request', function () {
    Http::fake(['builder.test/generate' => Http::response(['message' => 'Host not allowed: x'], 400)]);
    $model = $this->service->requestGeneration($this->place, 'x', ['https://x.test/a.jpg'], $this->user, dispatch: false);

    $this->service->dispatchGeneration($model);

    expect($model->fresh()->status)->toBe(ModelStatus::Failed)->and($model->fresh()->failure_reason)->toContain('Host not allowed');
});

it('stores a successful generation as a draft with its log', function () {
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);
    $model->update(['status' => ModelStatus::Generating]);

    callback($this, $model, completion())->assertNoContent();

    $model->refresh();
    expect($model->status)->toBe(ModelStatus::Draft)
        ->and($model->glb_path)->toBe("models/{$this->place->id}/v1/model.glb")
        ->and($model->spec['kitVersion'])->toBe('1.0')
        ->and($model->generation_log['triangles'])->toBe(900)
        ->and($model->generation_log['iterations'])->toHaveCount(2)
        ->and($model->generation_log['usage']['inputTokens'])->toBe(12000);
    expect(Storage::disk('s3')->get($model->glb_path))->toBe('GLB');
});

it('computes the cost from configured prices', function () {
    config(['llm.pricing' => ['input' => 2.0, 'output' => 10.0, 'cache_read' => 0.2, 'cache_write' => 2.5]]);
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);
    $model->update(['status' => ModelStatus::Generating]);

    callback($this, $model, completion());

    expect($model->fresh()->generation_log['cost_usd'])->toEqualWithDelta(0.024 + 0.03 + 0.0008, 1e-9);
});

it('records a failed generation with its reason', function () {
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);
    $model->update(['status' => ModelStatus::Generating]);

    callback($this, $model, ['jobId' => $model->id, 'status' => 'failed', 'reason' => 'parts[2] [grounded]: floats'])->assertNoContent();

    expect($model->fresh()->status)->toBe(ModelStatus::Failed)->and($model->fresh()->failure_reason)->toContain('floats');
});

it('rejects callbacks without the shared token', function () {
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);
    $model->update(['status' => ModelStatus::Generating]);

    callback($this, $model, completion(), 'wrong')->assertUnauthorized();
    $this->postJson("/api/internal/models/{$model->id}/callback", completion())->assertUnauthorized();

    expect($model->fresh()->status)->toBe(ModelStatus::Generating);
});

it('ignores callbacks for versions that are not waiting for one', function () {
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);
    $model->update(['status' => ModelStatus::Approved]);

    callback($this, $model, completion())->assertNoContent();

    expect($model->fresh()->status)->toBe(ModelStatus::Approved)->and($model->fresh()->glb_path)->toBeNull();
});

it('validates the callback payload', function () {
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);
    $model->update(['status' => ModelStatus::Generating]);

    callback($this, $model, ['status' => 'ok'])->assertStatus(422);
    callback($this, $model, ['status' => 'weird'])->assertStatus(422);
});

it('answers 404 for unknown versions', function () {
    $this->postJson('/api/internal/models/99999/callback', completion(), ['Authorization' => 'Bearer secret-token-123456'])->assertNotFound();
});

it('does not expose the callback when no token is configured', function () {
    config(['services.builder.token' => null]);
    $model = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);

    callback($this, $model, completion(), '')->assertUnauthorized();
});

it('expires generations whose callback never arrived', function () {
    $stuck = $this->service->requestGeneration($this->place, 'x', [], $this->user, dispatch: false);
    $stuck->update(['status' => ModelStatus::Generating]);
    $stuck->forceFill(['updated_at' => now()->subMinutes(45)])->saveQuietly();
    $recent = $this->service->requestGeneration($this->place, 'y', [], $this->user, dispatch: false);
    $recent->update(['status' => ModelStatus::Generating]);

    $this->artisan('models:expire-stuck')->assertSuccessful();

    expect($stuck->fresh()->status)->toBe(ModelStatus::Failed)->and($stuck->fresh()->failure_reason)->toContain('did not report back')
        ->and($recent->fresh()->status)->toBe(ModelStatus::Generating);
});
