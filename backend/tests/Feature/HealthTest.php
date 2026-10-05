<?php

use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\Fluent\AssertableJson;

it('reports every dependency as healthy', function () {
    $this->getJson('/api/health')
        ->assertOk()
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('status', 'ok')
            ->where('checks.database', true)
            ->where('checks.redis', true)
            ->where('checks.storage', true)
            ->where('checks.postgis', fn (string $version) => str_starts_with($version, '3.'))
        );
});

it('returns 503 with the failing check when redis is unreachable', function () {
    Redis::shouldReceive('connection')->andThrow(new RuntimeException('connection refused'));

    $this->getJson('/api/health')
        ->assertStatus(503)
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.redis', false)
        ->assertJsonPath('checks.database', true);
});

it('returns 503 with the failing check when storage is unreachable', function () {
    Storage::shouldReceive('disk')->with('s3')->andThrow(new RuntimeException('endpoint unreachable'));

    $this->getJson('/api/health')
        ->assertStatus(503)
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.storage', false)
        ->assertJsonPath('checks.redis', true);
});
