<?php

namespace App\Providers;

use App\Domain\Places\Place;
use App\Policies\PlacePolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Spatie\Translatable\Facades\Translatable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Translatable::fallback(fallbackLocale: 'es');
        Gate::policy(Place::class, PlacePolicy::class);
        RateLimiter::for('public-api', fn (Request $request) => Limit::perMinute(config('api.rate_limit'))->by($request->ip()));
    }
}
