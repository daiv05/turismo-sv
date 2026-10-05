<?php

namespace App\Domain\Places;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class PlaceModel extends Model
{
    protected $table = 'place_models';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => ModelStatus::class,
            'spec' => 'array',
            'thumbnail_paths' => 'array',
            'reference_media' => 'array',
            'generation_log' => 'array',
        ];
    }

    /**
     * Public URL of the glb, or null while the version has no file yet.
     */
    public function glbUrl(): ?string
    {
        return $this->glb_path ? Storage::disk(config('filesystems.default'))->url($this->glb_path) : null;
    }

    /**
     * Address of the standalone 3D preview page for this version. In development it points at the Vite server.
     */
    public function previewUrl(): ?string
    {
        $glb = $this->glbUrl();
        if ($glb === null) {
            return null;
        }
        $base = config('app.frontend_dev_url') ? rtrim((string) config('app.frontend_dev_url'), '/') : '/app';

        return "{$base}/studio.html?glb=".rawurlencode($glb);
    }

    public function place(): BelongsTo
    {
        return $this->belongsTo(Place::class);
    }
}
