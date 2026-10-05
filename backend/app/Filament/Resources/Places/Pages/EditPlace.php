<?php

namespace App\Filament\Resources\Places\Pages;

use App\Domain\Places\PlaceStatus;
use App\Domain\Places\PlaceWorkflow;
use App\Filament\Resources\Places\PlaceResource;
use App\Filament\Support\TranslatableForm;
use App\Support\Spatial;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;

class EditPlace extends EditRecord
{
    protected static string $resource = PlaceResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('submitForReview')
                ->label('Submit for review')
                ->visible(fn () => $this->record->status === PlaceStatus::Draft)
                ->action(fn () => $this->applyWorkflowChange(fn (PlaceWorkflow $w) => $w->submitForReview($this->record, auth()->user()), 'Submitted for review')),
            Action::make('approve')
                ->label('Approve and publish')
                ->color('success')
                ->requiresConfirmation()
                ->visible(fn () => $this->record->status === PlaceStatus::InReview && auth()->user()->can('publish', $this->record))
                ->action(fn () => $this->applyWorkflowChange(fn (PlaceWorkflow $w) => $w->approve($this->record, auth()->user()), 'Published')),
            Action::make('reject')
                ->label('Send back to draft')
                ->color('danger')
                ->requiresConfirmation()
                ->visible(fn () => $this->record->status === PlaceStatus::InReview && auth()->user()->can('publish', $this->record))
                ->action(fn () => $this->applyWorkflowChange(fn (PlaceWorkflow $w) => $w->reject($this->record, auth()->user()), 'Sent back to draft')),
            DeleteAction::make(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeFill(array $data): array
    {
        return TranslatableForm::fill($data, $this->record, ['name', 'summary', 'description']);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeSave(array $data): array
    {
        $data['location'] = Spatial::point((float) $data['lon'], (float) $data['lat']);
        unset($data['lon'], $data['lat'], $data['status']);

        return $data;
    }

    protected function afterSave(): void
    {
        app(PlaceWorkflow::class)->recordEditBy($this->record, auth()->user());
        $this->refreshFormData(['status']);
    }

    private function applyWorkflowChange(callable $change, string $message): void
    {
        $change(app(PlaceWorkflow::class));
        $this->record->refresh();
        $this->refreshFormData(['status']);
        Notification::make()->title($message)->success()->send();
    }
}
