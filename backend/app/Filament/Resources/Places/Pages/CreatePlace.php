<?php

namespace App\Filament\Resources\Places\Pages;

use App\Domain\Places\PlaceStatus;
use App\Filament\Resources\Places\PlaceResource;
use App\Support\Spatial;
use Filament\Resources\Pages\CreateRecord;

class CreatePlace extends CreateRecord
{
    protected static string $resource = PlaceResource::class;

    /**
     * New places always start as drafts owned by the creator, whatever the request carries.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['location'] = Spatial::point((float) $data['lon'], (float) $data['lat']);
        unset($data['lon'], $data['lat'], $data['status']);
        $data['status'] = PlaceStatus::Draft;
        $data['created_by'] = auth()->id();

        return $data;
    }
}
