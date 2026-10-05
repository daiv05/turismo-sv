<?php

namespace App\Domain\Places;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

final class BuilderClient
{
    /**
     * Builds a model document into a glb and thumbnails.
     *
     * @param  array<string, mixed>  $spec
     * @return array{glb: string, triangles: int, spec: array<string, mixed>, thumbnails: list<string>, warnings: list<string>}
     *
     * @throws BuilderRejected When the document breaks the style rules.
     * @throws BuilderUnavailable When the service cannot be reached or fails.
     */
    public function build(array $spec, bool $thumbnails = true): array
    {
        return $this->post('/build', ['spec' => $spec, 'thumbnails' => $thumbnails]);
    }

    /**
     * Starts an asynchronous AI generation; the builder reports the result to the callback URL.
     *
     * @param  array<string, mixed>  $payload
     *
     * @throws BuilderRejected When the request is invalid.
     * @throws BuilderUnavailable When the service cannot be reached or fails.
     */
    public function generate(array $payload): void
    {
        $this->post('/generate', $payload);
    }

    /**
     * Normalizes an externally modeled glb.
     *
     * @param  array{w: float, d: float}|null  $footprint
     * @return array{glb: string, triangles: int, size: array<string, float>, roles: list<string>}
     *
     * @throws BuilderRejected When the model is over budget, mis-scaled or invalid.
     * @throws BuilderUnavailable When the service cannot be reached or fails.
     */
    public function validateUpload(string $glbBinary, ?array $footprint = null): array
    {
        return $this->post('/validate-upload', array_filter([
            'glb' => base64_encode($glbBinary),
            'footprint' => $footprint,
        ]));
    }

    /** @param  array<string, mixed>  $payload */
    private function post(string $path, array $payload): array
    {
        try {
            $response = $this->http()->post($path, $payload);
        } catch (ConnectionException $e) {
            throw new BuilderUnavailable('The builder service could not be reached.', previous: $e);
        }

        return $this->handle($response);
    }

    private function handle(Response $response): array
    {
        if ($response->successful()) {
            return $response->json();
        }

        $status = $response->status();
        if ($status >= 500 || $status === 429) {
            throw new BuilderUnavailable("The builder service failed with status {$status}.");
        }

        $violations = (array) ($response->json('violations') ?? []);
        $message = $violations !== []
            ? collect($violations)->map(fn ($v) => trim(($v['path'] ?? '').': '.($v['message'] ?? ''), ': '))->implode("\n")
            : (string) ($response->json('message') ?? "The builder service refused the request ({$status}).");

        throw new BuilderRejected($message, $violations);
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl((string) config('services.builder.url'))
            ->withToken((string) config('services.builder.token'))
            ->acceptJson()
            ->asJson()
            ->timeout((int) config('services.builder.timeout', 120));
    }
}
