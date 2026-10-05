<?php

namespace App\Http\Controllers\Api;

use App\Domain\Places\PlaceModel;
use App\Domain\Places\PlaceModelService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class ModelCallbackController
{
    public function __invoke(Request $request, PlaceModel $model, PlaceModelService $service): Response
    {
        $data = $request->validate([
            'status' => ['required', 'in:ok,failed'],
            'reason' => ['nullable', 'string', 'max:5000'],
            'spec' => ['required_if:status,ok', 'array'],
            'glb' => ['required_if:status,ok', 'string'],
            'triangles' => ['nullable', 'integer', 'min:0'],
            'thumbnails' => ['nullable', 'array', 'max:6'],
            'thumbnails.*' => ['string'],
            'log' => ['nullable', 'array'],
        ]);

        $service->complete($model, $data);

        return response()->noContent();
    }
}
