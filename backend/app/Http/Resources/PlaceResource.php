<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin \App\Domain\Places\Place */
class PlaceResource extends JsonResource
{
    public function __construct($resource, private readonly bool $detailed = false)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        $category = $this->category;
        $model = $this->currentModel;

        $data = [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'summary' => $this->summary,
            'lon' => (float) $this->lon,
            'lat' => (float) $this->lat,
            'priority' => $this->priority,
            'category' => [
                'slug' => $category->slug,
                'name' => $category->name,
                'icon' => $category->icon,
                'color_token' => $category->color_token,
                'kind' => $category->kind->value,
            ],
            'model' => $model && $model->glb_path ? [
                'version' => $model->version,
                'glb_url' => Storage::disk(config('filesystems.default'))->url($model->glb_path),
            ] : null,
            'promotions' => $this->promotions->map(fn ($p) => [
                'id' => $p->id,
                'title' => $p->title,
                'body' => $p->body,
                'ends_at' => $p->ends_at->toIso8601String(),
                'sprite_type' => $p->sprite_type,
                'template_key' => $p->template_key,
            ])->values(),
        ];

        if ($this->detailed) {
            $data += [
                'description' => $this->description,
                'attributes' => $this->attributes ?? (object) [],
                'opening_hours' => $this->opening_hours,
            ];
        }

        return $data;
    }
}
