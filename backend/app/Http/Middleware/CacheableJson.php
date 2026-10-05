<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds a strong ETag and public cache headers to successful GET responses and answers conditional requests with 304.
 */
final class CacheableJson
{
    public function handle(Request $request, Closure $next, int $maxAge = 60): Response
    {
        $response = $next($request);

        if (! $request->isMethod('GET') || ! $response->isSuccessful()) {
            return $response;
        }

        $response->setEtag(md5((string) $response->getContent()));
        $response->headers->set('Cache-Control', "public, max-age={$maxAge}");
        $response->isNotModified($request);

        return $response;
    }
}
