<?php

use App\Domain\Tilesets\TilesetVersion;

it('registers a tileset version and makes it the current one', function () {
    $this->artisan('tilesets:register', ['version' => 'v1', 'base_url' => 'https://cdn.test/tiles/v1/', '--regions' => ['country', 'gran-san-salvador']])->assertSuccessful();

    $v = TilesetVersion::where('version', 'v1')->firstOrFail();
    expect($v->is_current)->toBeTrue()->and($v->regions)->toBe(['country', 'gran-san-salvador'])->and($v->built_at)->not->toBeNull();
});

it('keeps only the newest version current and the older ones for rollback', function () {
    $this->artisan('tilesets:register', ['version' => 'v1', 'base_url' => 'https://cdn.test/v1/'])->assertSuccessful();
    $this->artisan('tilesets:register', ['version' => 'v2', 'base_url' => 'https://cdn.test/v2/'])->assertSuccessful();

    expect(TilesetVersion::where('is_current', true)->pluck('version')->all())->toBe(['v2'])->and(TilesetVersion::count())->toBe(2);
    expect(TilesetVersion::current()->version)->toBe('v2');
});

it('can register a version without switching to it', function () {
    $this->artisan('tilesets:register', ['version' => 'v1', 'base_url' => 'https://cdn.test/v1/'])->assertSuccessful();
    $this->artisan('tilesets:register', ['version' => 'v2', 'base_url' => 'https://cdn.test/v2/', '--no-activate' => true])->assertSuccessful();

    expect(TilesetVersion::current()->version)->toBe('v1');
});

it('rolls back by activating an older version', function () {
    $this->artisan('tilesets:register', ['version' => 'v1', 'base_url' => 'https://cdn.test/v1/'])->assertSuccessful();
    $this->artisan('tilesets:register', ['version' => 'v2', 'base_url' => 'https://cdn.test/v2/'])->assertSuccessful();

    $this->artisan('tilesets:activate', ['version' => 'v1'])->assertSuccessful();

    expect(TilesetVersion::current()->version)->toBe('v1');
});

it('refuses to activate an unknown version', function () {
    $this->artisan('tilesets:activate', ['version' => 'nope'])->assertFailed();
});

it('registering an existing version again updates it', function () {
    $this->artisan('tilesets:register', ['version' => 'v1', 'base_url' => 'https://cdn.test/old/'])->assertSuccessful();
    $this->artisan('tilesets:register', ['version' => 'v1', 'base_url' => 'https://cdn.test/new/'])->assertSuccessful();

    expect(TilesetVersion::count())->toBe(1)->and(TilesetVersion::first()->base_url)->toBe('https://cdn.test/new/');
});

it('rejects base URLs that are not http(s) and normalizes the trailing slash', function () {
    $this->artisan('tilesets:register', ['version' => 'v1', 'base_url' => 'javascript:alert(1)'])->assertFailed();
    $this->artisan('tilesets:register', ['version' => 'v1', 'base_url' => 'https://cdn.test/v1'])->assertSuccessful();

    expect(TilesetVersion::first()->base_url)->toBe('https://cdn.test/v1/');
});
