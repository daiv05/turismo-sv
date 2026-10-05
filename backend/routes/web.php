<?php

use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PageController::class, 'home']);
Route::get('/lugar/{slug}', [PageController::class, 'place']);
Route::get('/zona/{slug}', [PageController::class, 'zone']);
