<?php

use App\Domain\Places\ModelStatus;
use App\Domain\Places\Place;
use App\Domain\Places\PlaceModel;
use App\Domain\Zones\Zone;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
});

it('creates a super admin with the given password', function () {
    $this->artisan('admin:create', ['email' => 'root@example.com', '--super' => true, '--password' => 'correct-horse-battery'])->assertSuccessful();

    $user = User::where('email', 'root@example.com')->firstOrFail();
    expect($user->hasRole('super_admin'))->toBeTrue()->and(Hash::check('correct-horse-battery', $user->password))->toBeTrue();
});

it('creates a zone admin attached to the given zones', function () {
    $zone = Zone::factory()->create(['slug' => 'centro']);

    $this->artisan('admin:create', ['email' => 'zona@example.com', '--zone' => ['centro'], '--password' => 'correct-horse-battery'])->assertSuccessful();

    $user = User::where('email', 'zona@example.com')->firstOrFail();
    expect($user->hasRole('zone_admin'))->toBeTrue()->and($user->zones->pluck('id')->all())->toBe([$zone->id]);
});

it('refuses a zone admin without zones, unknown zones and weak passwords', function () {
    $this->artisan('admin:create', ['email' => 'a@example.com', '--password' => 'correct-horse-battery'])->assertFailed();
    $this->artisan('admin:create', ['email' => 'b@example.com', '--zone' => ['nada'], '--password' => 'correct-horse-battery'])->assertFailed();
    $this->artisan('admin:create', ['email' => 'c@example.com', '--super' => true, '--password' => 'short'])->assertFailed();

    expect(User::count())->toBe(0);
});

it('does not create the same admin twice', function () {
    $this->artisan('admin:create', ['email' => 'root@example.com', '--super' => true, '--password' => 'correct-horse-battery'])->assertSuccessful();
    $this->artisan('admin:create', ['email' => 'root@example.com', '--super' => true, '--password' => 'correct-horse-battery'])->assertFailed();

    expect(User::count())->toBe(1);
});

it('generates a password when none is given and prints it once', function () {
    $this->artisan('admin:create', ['email' => 'gen@example.com', '--super' => true])
        ->expectsOutputToContain('Password:')
        ->assertSuccessful();

    expect(User::where('email', 'gen@example.com')->exists())->toBeTrue();
});

describe('models:seed-reference', function () {
    beforeEach(function () {
        config(['services.builder.url' => 'http://builder.test', 'services.builder.token' => 'secret-token-123456', 'filesystems.default' => 's3']);
        Storage::fake('s3');
        $this->dir = sys_get_temp_dir().'/models-'.uniqid();
        mkdir($this->dir);
        file_put_contents("{$this->dir}/catedral.json", json_encode(['kitVersion' => '1.0', 'footprint' => ['w' => 1, 'd' => 1], 'parts' => []]));
        file_put_contents("{$this->dir}/desconocido.json", json_encode(['kitVersion' => '1.0', 'footprint' => ['w' => 1, 'd' => 1], 'parts' => []]));
        $this->admin = User::factory()->create(['email' => 'root@example.com'])->assignRole('super_admin');
    });

    function builderAccepts(): void
    {
        Http::fake(['builder.test/build' => Http::response([
            'glb' => base64_encode('GLB'), 'triangles' => 500, 'spec' => ['kitVersion' => '1.0'], 'thumbnails' => [base64_encode('P')], 'warnings' => [],
        ])]);
    }

    it('builds and approves a model for every place that has a document', function () {
        builderAccepts();
        $place = Place::factory()->create(['slug' => 'catedral']);

        $this->artisan('models:seed-reference', ['--path' => $this->dir, '--as' => 'root@example.com'])->assertSuccessful();

        $model = PlaceModel::firstOrFail();
        expect($model->status)->toBe(ModelStatus::Approved)->and($place->fresh()->current_model_id)->toBe($model->id);
    });

    it('skips documents without a matching place and reports them', function () {
        builderAccepts();
        Place::factory()->create(['slug' => 'catedral']);

        $this->artisan('models:seed-reference', ['--path' => $this->dir, '--as' => 'root@example.com'])
            ->expectsOutputToContain('desconocido')
            ->assertSuccessful();

        expect(PlaceModel::count())->toBe(1);
    });

    it('does not duplicate versions on a second run', function () {
        builderAccepts();
        Place::factory()->create(['slug' => 'catedral']);

        $this->artisan('models:seed-reference', ['--path' => $this->dir, '--as' => 'root@example.com'])->assertSuccessful();
        $this->artisan('models:seed-reference', ['--path' => $this->dir, '--as' => 'root@example.com'])->assertSuccessful();

        expect(PlaceModel::count())->toBe(1);
    });

    it('fails when the reviewer is not a super admin', function () {
        builderAccepts();
        Place::factory()->create(['slug' => 'catedral']);
        User::factory()->create(['email' => 'plain@example.com']);

        $this->artisan('models:seed-reference', ['--path' => $this->dir, '--as' => 'plain@example.com'])->assertFailed();
        $this->artisan('models:seed-reference', ['--path' => $this->dir, '--as' => 'nobody@example.com'])->assertFailed();
    });

    it('fails with a clear message when the builder rejects a document', function () {
        Place::factory()->create(['slug' => 'catedral']);
        Http::fake(['builder.test/build' => Http::response(['error' => 'rules', 'violations' => [['path' => 'parts[0]', 'message' => 'floats']]], 422)]);

        $this->artisan('models:seed-reference', ['--path' => $this->dir, '--as' => 'root@example.com'])
            ->expectsOutputToContain('floats')
            ->assertFailed();
    });
});
