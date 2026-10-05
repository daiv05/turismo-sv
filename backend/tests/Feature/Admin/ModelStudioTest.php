<?php

use App\Domain\Places\ModelStatus;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceModel;
use App\Domain\Zones\Zone;
use App\Filament\Resources\Places\Pages\EditPlace;
use App\Filament\Resources\Places\RelationManagers\ModelsRelationManager;
use App\Jobs\BuildPlaceModelJob;
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    config(['services.builder.url' => 'http://builder.test', 'services.builder.token' => 'secret-token-123456', 'filesystems.default' => 's3']);
    Storage::fake('s3');
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
    Filament::setCurrentPanel('admin');
    $zone = Zone::factory()->bounds(-89.25, 13.68, -89.15, 13.72)->create();
    $this->superAdmin = User::factory()->create()->assignRole('super_admin');
    $this->zoneAdmin = User::factory()->create()->assignRole('zone_admin');
    $this->zoneAdmin->zones()->attach($zone);
    $this->place = Place::factory()->at(-89.19, 13.70)->create();
    $this->spec = json_encode(['kitVersion' => '1.0', 'footprint' => ['w' => 40, 'd' => 40], 'parts' => [['type' => 'hall', 'params' => ['w' => 10, 'd' => 10, 'h' => 5], 'pos' => [0, 0, 0], 'rot' => 0, 'role' => 'neutral']]]);
});

function studio(User $user, Place $place)
{
    return Livewire::actingAs($user)->test(ModelsRelationManager::class, ['ownerRecord' => $place, 'pageClass' => EditPlace::class]);
}

function modelFor(Place $place, array $over = []): PlaceModel
{
    return PlaceModel::create(array_merge(['place_id' => $place->id, 'version' => 1, 'source' => 'kit', 'status' => ModelStatus::Draft, 'glb_path' => "models/{$place->id}/v1/model.glb"], $over));
}

it('lists the versions of the place only', function () {
    $model = modelFor($this->place);
    $other = modelFor(Place::factory()->create());

    studio($this->zoneAdmin, $this->place)->assertCanSeeTableRecords([$model])->assertCanNotSeeTableRecords([$other]);
});

it('is available only to users who can edit the place', function () {
    $outside = Place::factory()->at(-89.56, 13.99)->create();

    expect(ModelsRelationManager::canViewForRecord($this->place, EditPlace::class))->toBeFalse();
    $this->actingAs($this->zoneAdmin);
    expect(ModelsRelationManager::canViewForRecord($this->place, EditPlace::class))->toBeTrue()
        ->and(ModelsRelationManager::canViewForRecord($outside, EditPlace::class))->toBeFalse();
});

it('queues a build from a kit document', function () {
    Queue::fake();

    studio($this->zoneAdmin, $this->place)
        ->callAction(TestAction::make('createFromSpec')->table(), ['spec' => $this->spec, 'prompt' => 'Un salón pequeño'])
        ->assertHasNoFormErrors();

    $model = PlaceModel::firstOrFail();
    expect($model->status)->toBe(ModelStatus::Queued)->and($model->prompt)->toBe('Un salón pequeño')->and($model->created_by)->toBe($this->zoneAdmin->id)
        ->and($model->spec['kitVersion'])->toBe('1.0');
    Queue::assertPushed(BuildPlaceModelJob::class);
});

it('refuses documents that are not a JSON object', function (string $text) {
    Queue::fake();

    studio($this->zoneAdmin, $this->place)
        ->callAction(TestAction::make('createFromSpec')->table(), ['spec' => $text])
        ->assertHasFormErrors(['spec']);

    expect(PlaceModel::count())->toBe(0);
})->with(['{nope', '[1,2]', '"text"']);

it('lets only a super admin approve a draft and publishes it as the current model', function () {
    $model = modelFor($this->place);

    studio($this->zoneAdmin, $this->place)
        ->assertActionHidden(TestAction::make('approve')->table($model))
        ->assertActionHidden(TestAction::make('reject')->table($model));
    studio($this->superAdmin, $this->place)
        ->assertActionVisible(TestAction::make('approve')->table($model))
        ->callAction(TestAction::make('approve')->table($model), ['notes' => 'Aprobado'])
        ->assertHasNoFormErrors();

    expect($model->fresh()->status)->toBe(ModelStatus::Approved)->and($this->place->fresh()->current_model_id)->toBe($model->id);
});

it('rejects a draft with notes', function () {
    $model = modelFor($this->place);

    studio($this->superAdmin, $this->place)->callAction(TestAction::make('reject')->table($model), ['notes' => 'Muy alto']);

    expect($model->fresh()->status)->toBe(ModelStatus::Rejected)->and($model->fresh()->review_notes)->toBe('Muy alto');
});

it('requires notes to reject', function () {
    $model = modelFor($this->place);

    studio($this->superAdmin, $this->place)->callAction(TestAction::make('reject')->table($model), ['notes' => ''])->assertHasFormErrors(['notes']);
});

it('does not offer review actions on versions that are not drafts', function () {
    $model = modelFor($this->place, ['status' => ModelStatus::Failed, 'glb_path' => null]);

    studio($this->superAdmin, $this->place)->assertActionHidden(TestAction::make('approve')->table($model));
});

it('retries a failed version', function () {
    Queue::fake();
    $model = modelFor($this->place, ['status' => ModelStatus::Failed, 'failure_reason' => 'x', 'glb_path' => null]);

    studio($this->zoneAdmin, $this->place)->callAction(TestAction::make('retry')->table($model));

    expect($model->fresh()->status)->toBe(ModelStatus::Queued)->and($model->fresh()->failure_reason)->toBeNull();
    Queue::assertPushed(BuildPlaceModelJob::class);
});

it('only offers retry on failed versions', function () {
    $model = modelFor($this->place);

    studio($this->zoneAdmin, $this->place)->assertActionHidden(TestAction::make('retry')->table($model));
});

it('lets only a super admin upload an external glb', function () {
    studio($this->zoneAdmin, $this->place)->assertActionHidden(TestAction::make('uploadGlb')->table());
    studio($this->superAdmin, $this->place)->assertActionVisible(TestAction::make('uploadGlb')->table());
});

it('stores an uploaded glb as a draft after the builder normalizes it', function () {
    Http::fake(['builder.test/validate-upload' => Http::response(['glb' => base64_encode('NORMALIZED'), 'triangles' => 500, 'size' => ['x' => 1, 'y' => 1, 'z' => 1], 'roles' => ['neutral']])]);

    studio($this->superAdmin, $this->place)
        ->callAction(TestAction::make('uploadGlb')->table(), ['glb' => UploadedFile::fake()->createWithContent('model.glb', 'RAW')])
        ->assertHasNoFormErrors();

    $model = PlaceModel::firstOrFail();
    expect($model->source)->toBe('upload')->and($model->status)->toBe(ModelStatus::Draft);
    expect(Storage::disk('s3')->get($model->glb_path))->toBe('NORMALIZED');
});

it('shows the builder explanation when an upload is rejected', function () {
    Http::fake(['builder.test/validate-upload' => Http::response(['code' => 'scale', 'message' => 'The largest dimension is 0.02 m'], 422)]);

    studio($this->superAdmin, $this->place)
        ->callAction(TestAction::make('uploadGlb')->table(), ['glb' => UploadedFile::fake()->createWithContent('model.glb', 'RAW')])
        ->assertNotified();

    expect(PlaceModel::count())->toBe(0);
});

it('queues an AI generation with a description and reference photos', function () {
    Queue::fake();

    studio($this->zoneAdmin, $this->place)
        ->callAction(TestAction::make('generateWithAi')->table(), [
            'description' => 'Iglesia colonial con cúpula azul',
            'photos' => [UploadedFile::fake()->image('ref.jpg')],
        ])
        ->assertHasNoFormErrors();

    $model = PlaceModel::firstOrFail();
    expect($model->status)->toBe(ModelStatus::Queued)->and($model->prompt)->toBe('Iglesia colonial con cúpula azul')
        ->and($model->reference_media)->toHaveCount(1)->and($model->reference_media[0])->toContain('references/');
    Queue::assertPushed(App\Jobs\RequestGenerationJob::class);
});

it('requires a description to generate', function () {
    Queue::fake();

    studio($this->zoneAdmin, $this->place)
        ->callAction(TestAction::make('generateWithAi')->table(), ['description' => ''])
        ->assertHasFormErrors(['description']);

    expect(PlaceModel::count())->toBe(0);
});

it('does not offer generation to users who cannot edit the place', function () {
    $outside = Place::factory()->at(-89.56, 13.99)->create();

    expect(ModelsRelationManager::canViewForRecord($outside, EditPlace::class))->toBeFalse();
});

it('builds the preview address from the public model URL', function () {
    config(['app.frontend_dev_url' => null]);
    $model = modelFor($this->place, ['glb_path' => 'models/1/v2/model.glb']);
    $public = Storage::disk('s3')->url('models/1/v2/model.glb');

    expect($model->previewUrl())->toBe('/app/studio.html?glb='.rawurlencode($public));

    config(['app.frontend_dev_url' => 'http://localhost:5173/']);
    expect($model->previewUrl())->toStartWith('http://localhost:5173/studio.html?glb=');
});

it('has no preview for versions without a file', function () {
    expect(modelFor($this->place, ['glb_path' => null, 'status' => ModelStatus::Failed])->previewUrl())->toBeNull();
});

it('offers the 3D preview only when there is a file', function () {
    $with = modelFor($this->place);
    $without = modelFor($this->place, ['version' => 2, 'glb_path' => null, 'status' => ModelStatus::Failed]);

    studio($this->superAdmin, $this->place)
        ->assertActionHidden(TestAction::make('preview')->table($without))
        ->assertActionVisible(TestAction::make('preview')->table($with));
});
