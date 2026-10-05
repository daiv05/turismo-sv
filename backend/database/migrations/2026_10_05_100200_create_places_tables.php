<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('places', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->foreignId('zone_id')->nullable()->constrained()->nullOnDelete();
            $table->json('name');
            $table->string('slug')->unique();
            $table->json('summary')->nullable();
            $table->json('description')->nullable();
            $table->geometry('location', 'point', 4326);
            $table->geometry('footprint', 'polygon', 4326)->nullable();
            $table->json('attributes')->nullable();
            $table->json('opening_hours')->nullable();
            $table->integer('priority')->default(0);
            $table->string('status')->default('draft');
            $table->unsignedBigInteger('current_model_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->spatialIndex('location');
            $table->index(['status', 'category_id']);
        });

        Schema::create('place_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('place_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('source');
            $table->string('kit_version')->nullable();
            $table->json('spec')->nullable();
            $table->string('glb_path')->nullable();
            $table->json('thumbnail_paths')->nullable();
            $table->text('prompt')->nullable();
            $table->json('reference_media')->nullable();
            $table->string('status')->default('queued');
            $table->text('failure_reason')->nullable();
            $table->json('generation_log')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_notes')->nullable();
            $table->timestamps();

            $table->unique(['place_id', 'version']);
        });

        Schema::table('places', function (Blueprint $table) {
            $table->foreign('current_model_id')->references('id')->on('place_models')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('places', function (Blueprint $table) {
            $table->dropForeign(['current_model_id']);
        });
        Schema::dropIfExists('place_models');
        Schema::dropIfExists('places');
    }
};
