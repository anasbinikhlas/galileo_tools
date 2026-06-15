<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ssr_entries', function (Blueprint $table) {
            $table->id();
            $table->string('airline', 2);
            $table->string('pnr', 20)->nullable();
            $table->text('ssr_lines');
            $table->text('raw_input')->nullable();
            $table->string('agent_ip', 45)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ssr_entries');
    }
};