<?php

namespace App\Filament\Resources\Promotions\Pages;

use App\Domain\Places\PlaceStatus;
use App\Filament\Resources\Promotions\PromotionResource;
use App\Filament\Support\MapsDomainValidation;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;

class CreatePromotion extends CreateRecord
{
    use MapsDomainValidation;

    protected static string $resource = PromotionResource::class;

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data = PromotionResource::normalize($data);
        $data['status'] = PlaceStatus::Draft;

        return $data;
    }

    /** @param  array<string, mixed>  $data */
    protected function handleRecordCreation(array $data): Model
    {
        return $this->withFormErrors(fn () => parent::handleRecordCreation($data));
    }
}
