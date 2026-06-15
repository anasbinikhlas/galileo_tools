<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class SsrEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'airline',
        'pnr',
        'ssr_lines',
        'raw_input',
        'agent_ip',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
