<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SSRController;

Route::prefix('ssr')->group(function () {
    Route::post('/build',  [SSRController::class, 'build']);
    Route::post('/save',   [SSRController::class, 'save']);
    Route::get('/history', [SSRController::class, 'history']);
});