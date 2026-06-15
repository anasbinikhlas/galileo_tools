<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use App\Models\SsrEntry;

class SSRController extends Controller
{
    /**
     * Build SSR DOCS line(s) from passenger data.
     * Accepts an array of passengers + airline code.
     *
     * POST /api/ssr/build
     * Body: {
     *   airline: "SV",
     *   passengers: [
     *     {
     *       surname: "IKHLAS",
     *       given: "ANAS",
     *       ppnum: "KZ1342592",
     *       nat: "PAK",
     *       issuer: "PAK",
     *       dob: "12MAY95",
     *       exp: "20JAN35",
     *       gender: "M"
     *     }
     *   ]
     * }
     */
    public function build(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'airline'                => 'required|string|size:2',
            'passengers'             => 'required|array|min:1|max:9',
            'passengers.*.surname'   => 'required|string|max:50',
            'passengers.*.given'     => 'required|string|max:50',
            'passengers.*.ppnum'     => 'required|string|max:20',
            'passengers.*.nat'       => 'required|string|size:3',
            'passengers.*.issuer'    => 'nullable|string|size:3',
            'passengers.*.dob'       => ['required', 'string', 'regex:/^\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}$/'],
            'passengers.*.exp'       => ['required', 'string', 'regex:/^\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{2}$/'],
            'passengers.*.gender'    => 'required|in:M,F,MI,FI',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $airline    = strtoupper(trim($request->airline));
        $passengers = $request->passengers;
        $lines      = [];

        foreach ($passengers as $i => $pax) {
            $paxNum  = $i + 1;
            $surname = strtoupper(trim($pax['surname']));
            $given   = strtoupper(trim($pax['given']));
            $ppnum   = strtoupper(trim($pax['ppnum']));
            $nat     = strtoupper(trim($pax['nat']));
            $issuer  = strtoupper(trim($pax['issuer'] ?? $nat));
            $dob     = strtoupper(trim($pax['dob']));
            $exp     = strtoupper(trim($pax['exp']));
            $gender  = strtoupper(trim($pax['gender']));

            $line = "SI.P{$paxNum}/SSRDOCS{$airline}HK1/P/{$issuer}/{$ppnum}/{$nat}/{$dob}/{$gender}/{$exp}/{$surname}/{$given} MR";

            $lines[] = [
                'passenger' => $paxNum,
                'line'      => $line,
                'surname'   => $surname,
                'given'     => $given,
            ];
        }

        return response()->json([
            'success' => true,
            'airline' => $airline,
            'count'   => count($lines),
            'lines'   => $lines,
            'joined'  => implode("\n", array_column($lines, 'line')),
        ]);
    }

    /**
     * Save SSR entry to database.
     * POST /api/ssr/save
     */
    public function save(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'airline'    => 'required|string|size:2',
            'pnr'        => 'nullable|string|max:20',
            'ssr_lines'  => 'required|string',
            'raw_input'  => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $entry = SsrEntry::create([
            'airline'   => strtoupper($request->airline),
            'pnr'       => $request->pnr ? strtoupper($request->pnr) : null,
            'ssr_lines' => $request->ssr_lines,
            'raw_input' => $request->raw_input,
            'agent_ip'  => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'id'      => $entry->id,
            'message' => 'SSR entry saved',
        ]);
    }

    /**
     * Get last 20 SSR entries.
     * GET /api/ssr/history
     */
    public function history(): JsonResponse
    {
        $entries = SsrEntry::latest()->take(20)->get([
            'id', 'airline', 'pnr', 'ssr_lines', 'created_at',
        ]);

        return response()->json([
            'success' => true,
            'data'    => $entries,
        ]);
    }
}
