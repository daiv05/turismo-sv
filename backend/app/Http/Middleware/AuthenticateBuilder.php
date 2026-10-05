<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets only the builder service call internal endpoints, using the token it shares with Laravel.
 */
final class AuthenticateBuilder
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.builder.token');
        $given = (string) $request->bearerToken();

        if ($expected === '' || $given === '' || ! hash_equals($expected, $given)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
