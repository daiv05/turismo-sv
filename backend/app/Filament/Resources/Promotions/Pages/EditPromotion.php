<?php

namespace App\Filament\Resources\Promotions\Pages;

use App\Domain\Places\PlaceStatus;
use App\Domain\Promotions\PromotionWorkflow;
use App\Filament\Resources\Promotions\PromotionResource;
use App\Filament\Support\MapsDomainValidation;
use App\Filament\Support\TranslatableForm;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;

class EditPromotion extends EditRecord
{
    use MapsDomainValidation;

    protected static string $resource = PromotionResource::class;

    protected function getHeaderActions(): array
    {
        $isReviewable = fn () => $this->record->status === PlaceStatus::InReview && auth()->user()->can('publish', $this->record);

        return [
            Action::make('submitForReview')
                ->label('Submit for review')
                ->visible(fn () => $this->record->status === PlaceStatus::Draft)
                ->action(fn () => $this->change(fn (PromotionWorkflow $w) => $w->submitForReview($this->record, auth()->user()), 'Submitted for review')),
            Action::make('approve')
                ->label('Approve and publish')
                ->color('success')
                ->requiresConfirmation()
                ->visible($isReviewable)
                ->action(fn () => $this->change(fn (PromotionWorkflow $w) => $w->approve($this->record, auth()->user()), 'Published')),
            Action::make('reject')
                ->label('Send back to draft')
                ->color('danger')
                ->requiresConfirmation()
                ->visible($isReviewable)
                ->action(fn () => $this->change(fn (PromotionWorkflow $w) => $w->reject($this->record, auth()->user()), 'Sent back to draft')),
            DeleteAction::make(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeFill(array $data): array
    {
        $data = TranslatableForm::fill($data, $this->record, ['title', 'body']);
        $data['sprite_image'] = $this->record->sprite_path;

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeSave(array $data): array
    {
        unset($data['status']);

        return PromotionResource::normalize($data);
    }

    /** @param  array<string, mixed>  $data */
    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        return $this->withFormErrors(fn () => parent::handleRecordUpdate($record, $data));
    }

    protected function afterSave(): void
    {
        app(PromotionWorkflow::class)->recordEditBy($this->record, auth()->user());
        $this->refreshFormData(['status']);
    }

    private function change(callable $change, string $message): void
    {
        $change(app(PromotionWorkflow::class));
        $this->record->refresh();
        $this->refreshFormData(['status']);
        Notification::make()->title($message)->success()->send();
    }
}
