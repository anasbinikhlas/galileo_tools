<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SSRController;

use App\Http\Controllers\DataSyncController;

Route::prefix('ssr')->group(function () {
    Route::post('/build',  [SSRController::class, 'build']);
    Route::post('/save',   [SSRController::class, 'save']);
    Route::get('/history', [SSRController::class, 'history']);
});

// Global Cross-Device Data Sync Routes
Route::get('/clients', [DataSyncController::class, 'getClients']);
Route::post('/clients/sync', [DataSyncController::class, 'syncClients']);
Route::delete('/clients/{clientId}', [DataSyncController::class, 'deleteClient']);

Route::get('/invoices', [DataSyncController::class, 'getInvoices']);
Route::post('/invoices/sync', [DataSyncController::class, 'syncInvoices']);
Route::delete('/invoices/{invoiceId}', [DataSyncController::class, 'deleteInvoice']);

Route::get('/contacts', [DataSyncController::class, 'getContacts']);
Route::post('/contacts/sync', [DataSyncController::class, 'syncContacts']);
Route::delete('/contacts/{contactId}', [DataSyncController::class, 'deleteContact']);