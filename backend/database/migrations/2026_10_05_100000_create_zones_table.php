<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $table) {
            $table->id();
            $table->json('name');
            $table->string('slug')->unique();
            $table->string('type');
            $table->foreignId('parent_id')->nullable()->constrained('zones')->nullOnDelete();
            $table->geometry('boundary', 'multipolygon', 4326)->nullable();
            $table->json('camera')->nullable();
            $table->timestamps();

            $table->spatialIndex('boundary');
        });

        Schema::create('zone_user', function (Blueprint $table) {
            $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['zone_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zone_user');
        Schema::dropIfExists('zones');
    }
};
