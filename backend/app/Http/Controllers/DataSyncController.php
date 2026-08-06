<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Contact;

class DataSyncController extends Controller
{
    // --- CLIENTS ---
    public function getClients(): JsonResponse
    {
        $clients = Client::latest()->get();
        $formatted = $clients->map(function ($c) {
            if ($c->data) {
                $decoded = json_decode($c->data, true);
                if (is_array($decoded)) {
                    $decoded['id'] = $c->client_id;
                    $decoded['name'] = $c->name ?? ($decoded['name'] ?? '');
                    $decoded['status'] = $c->status ?? ($decoded['status'] ?? 'Pending');
                    return $decoded;
                }
            }
            return [
                'id' => $c->client_id,
                'name' => $c->name,
                'status' => $c->status,
            ];
        });

        return response()->json([
            'success' => true,
            'clients' => $formatted,
        ]);
    }

    public function syncClients(Request $request): JsonResponse
    {
        $clientsList = $request->input('clients', []);
        if (!is_array($clientsList)) {
            return response()->json(['success' => false, 'message' => 'Invalid data payload'], 400);
        }

        foreach ($clientsList as $item) {
            if (!is_array($item)) continue;
            $clientId = $item['id'] ?? ('client-' . uniqid());
            $name = $item['header']['name'] ?? ($item['name'] ?? 'Client');
            $status = $item['status'] ?? 'Pending';

            Client::updateOrCreate(
                ['client_id' => (string) $clientId],
                [
                    'name'   => (string) $name,
                    'status' => (string) $status,
                    'data'   => json_encode($item),
                ]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Clients synced to database successfully',
        ]);
    }

    public function deleteClient($clientId): JsonResponse
    {
        Client::where('client_id', $clientId)->delete();
        return response()->json(['success' => true]);
    }

    // --- INVOICES ---
    public function getInvoices(): JsonResponse
    {
        $invoices = Invoice::latest()->get();
        $formatted = $invoices->map(function ($inv) {
            if ($inv->data) {
                $decoded = json_decode($inv->data, true);
                if (is_array($decoded)) {
                    $decoded['id'] = $inv->invoice_id;
                    return $decoded;
                }
            }
            return [
                'id' => $inv->invoice_id,
                'invoice_no' => $inv->invoice_no,
                'client_name' => $inv->client_name,
            ];
        });

        return response()->json([
            'success' => true,
            'invoices' => $formatted,
        ]);
    }

    public function syncInvoices(Request $request): JsonResponse
    {
        $invoicesList = $request->input('invoices', []);
        if (!is_array($invoicesList)) {
            return response()->json(['success' => false, 'message' => 'Invalid data payload'], 400);
        }

        foreach ($invoicesList as $item) {
            if (!is_array($item)) continue;
            $invId = $item['id'] ?? ('inv-' . uniqid());
            $invNo = $item['invoiceNo'] ?? ($item['sr_no'] ?? '');
            $clientName = $item['clientName'] ?? ($item['name'] ?? '');

            Invoice::updateOrCreate(
                ['invoice_id' => (string) $invId],
                [
                    'invoice_no'  => (string) $invNo,
                    'client_name' => (string) $clientName,
                    'data'        => json_encode($item),
                ]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Invoices synced to database successfully',
        ]);
    }

    public function deleteInvoice($invId): JsonResponse
    {
        Invoice::where('invoice_id', $invId)->delete();
        return response()->json(['success' => true]);
    }

    // --- CONTACTS ---
    public function getContacts(): JsonResponse
    {
        $contacts = Contact::latest()->get();
        $formatted = $contacts->map(function ($cnt) {
            if ($cnt->data) {
                $decoded = json_decode($cnt->data, true);
                if (is_array($decoded)) {
                    $decoded['id'] = $cnt->contact_id;
                    return $decoded;
                }
            }
            return [
                'id' => $cnt->contact_id,
                'name' => $cnt->name,
            ];
        });

        return response()->json([
            'success' => true,
            'contacts' => $formatted,
        ]);
    }

    public function syncContacts(Request $request): JsonResponse
    {
        $contactsList = $request->input('contacts', []);
        if (!is_array($contactsList)) {
            return response()->json(['success' => false, 'message' => 'Invalid data payload'], 400);
        }

        foreach ($contactsList as $item) {
            if (!is_array($item)) continue;
            $cntId = $item['id'] ?? ('cnt-' . uniqid());
            $name = $item['name'] ?? 'Contact';

            Contact::updateOrCreate(
                ['contact_id' => (string) $cntId],
                [
                    'name' => (string) $name,
                    'data' => json_encode($item),
                ]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Contacts synced to database successfully',
        ]);
    }

    public function deleteContact($cntId): JsonResponse
    {
        Contact::where('contact_id', $cntId)->delete();
        return response()->json(['success' => true]);
    }
}
