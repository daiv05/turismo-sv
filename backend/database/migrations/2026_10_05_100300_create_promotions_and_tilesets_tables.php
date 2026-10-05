<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('place_id')->constrained()->cascadeOnDelete();
            $table->json('title');
            $table->json('body')->nullable();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->string('status')->default('draft');
            $table->integer('priority')->default(0);
            $table->string('sprite_type')->default('static');
            $table->unsignedSmallInteger('sprite_frames')->default(1);
            $table->unsignedSmallInteger('sprite_cols')->default(1);
            $table->unsignedSmallInteger('sprite_rows')->default(1);
            $table->unsignedSmallInteger('sprite_fps')->default(8);
            $table->string('template_key')->nullable();
            $table->json('template_data')->nullable();
            $table->timestamps();

            $table->index(['status', 'starts_at', 'ends_at']);
        });

        Schema::create('tileset_versions', function (Blueprint $table) {
            $table->id();
            $table->string('version')->unique();
            $table->string('base_url');
            $table->json('regions')->nullable();
            $table->boolean('is_current')->default(false);
            $table->timestampTz('built_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tileset_versions');
        Schema::dropIfExists('promotions');
    }
};
