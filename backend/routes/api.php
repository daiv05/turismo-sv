<?php

use App\Http\Controllers\Api\ConfigController;
use App\Http\Controllers\Api\ModelCallbackController;
use App\Http\Controllers\Api\PlaceController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\ZoneController;
use App\Http\Controllers\HealthController;
use App\Http\Middleware\AuthenticateBuilder;
use App\Http\Middleware\CacheableJson;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::middleware(['throttle:public-api', CacheableJson::class.':60'])->group(function () {
    Route::get('/config', ConfigController::class);
    Route::get('/places', [PlaceController::class, 'index']);
    Route::get('/places/{slug}', [PlaceController::class, 'show']);
    Route::get('/zones/{slug}', [ZoneController::class, 'show']);
    Route::get('/search', SearchController::class);
});

Route::middleware(['throttle:120,1', AuthenticateBuilder::class])->post('/internal/models/{model}/callback', ModelCallbackController::class);
