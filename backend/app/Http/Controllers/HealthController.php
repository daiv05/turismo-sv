<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class HealthController
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->probe(fn () => DB::select('select 1 as ok') !== []),
            'postgis' => $this->probe(fn () => (string) DB::scalar('select postgis_lib_version()')),
            'redis' => $this->probe(fn () => (bool) Redis::connection()->ping()),
            'storage' => $this->probe(fn () => $this->storageRoundTrip()),
        ];

        $healthy = ! in_array(false, $checks, true);

        return response()->json(
            ['status' => $healthy ? 'ok' : 'degraded', 'checks' => $checks],
            $healthy ? 200 : 503,
        );
    }

    /**
     * Runs a dependency probe and converts any failure into false.
     *
     * @param  Closure(): (bool|string)  $probe  Probe returning true, false or a version string.
     * @return bool|string Probe result, or false when it throws.
     */
    private function probe(Closure $probe): bool|string
    {
        try {
            return $probe();
        } catch (Throwable) {
            return false;
        }
    }

    private function storageRoundTrip(): bool
    {
        $disk = Storage::disk('s3');
        $path = 'health/probe.txt';

        $disk->put($path, 'ok');
        $ok = $disk->get($path) === 'ok';
        $disk->delete($path);

        return $ok;
    }
}
