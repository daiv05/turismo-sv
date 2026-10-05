<?php

namespace App\Filament\Resources\Places\RelationManagers;

use App\Domain\Places\BuilderRejected;
use App\Domain\Places\BuilderUnavailable;
use App\Domain\Places\ModelStatus;
use App\Domain\Places\PlaceModel;
use App\Domain\Places\PlaceModelService;
use App\Jobs\BuildPlaceModelJob;
use Closure;
use Filament\Actions\Action;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * The 3D studio of a place: every model version with its thumbnails, plus the actions to create versions from a
 * kit document, upload an external glb and review drafts.
 */
class ModelsRelationManager extends RelationManager
{
    protected static string $relationship = 'models';

    protected static ?string $title = '3D models';

    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return auth()->user()?->can('update', $ownerRecord) ?? false;
    }

    public function table(Table $table): Table
    {
        $service = fn (): PlaceModelService => app(PlaceModelService::class);
        $isSuperAdmin = fn (): bool => auth()->user()?->hasRole('super_admin') ?? false;

        return $table
            ->columns([
                TextColumn::make('version')->prefix('v')->sortable(),
                ImageColumn::make('thumbnail')
                    ->state(fn (PlaceModel $record) => $record->thumbnail_paths[0] ?? null)
                    ->disk(config('filesystems.default'))
                    ->visibility('public'),
                TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn ($state) => $state instanceof ModelStatus ? $state->value : $state)
                    ->color(fn ($state) => match ($state) {
                        ModelStatus::Approved => 'success',
                        ModelStatus::Draft => 'info',
                        ModelStatus::Failed, ModelStatus::Rejected => 'danger',
                        default => 'warning',
                    }),
                TextColumn::make('source'),
                TextColumn::make('generation_log.triangles')->label('Triangles')->numeric(),
                TextColumn::make('failure_reason')->limit(60)->tooltip(fn (PlaceModel $record) => $record->failure_reason),
                TextColumn::make('review_notes')->limit(40),
            ])
            ->defaultSort('version', 'desc')
            ->headerActions([
                Action::make('createFromSpec')
                    ->label('New version from kit document')
                    ->schema([
                        Textarea::make('spec')
                            ->label('Kit document (JSON)')
                            ->required()
                            ->rows(14)
                            ->rules([fn (): Closure => function (string $attribute, mixed $value, Closure $fail): void {
                                $decoded = json_decode((string) $value, true);
                                if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded) || array_is_list($decoded)) {
                                    $fail('The document must be a JSON object.');
                                }
                            }]),
                        Textarea::make('prompt')->label('Notes')->rows(2),
                    ])
                    ->action(function (array $data) use ($service): void {
                        $service()->createFromSpec($this->getOwnerRecord(), json_decode($data['spec'], true), auth()->user(), $data['prompt'] ?? null);
                        Notification::make()->title('Build queued')->success()->send();
                    }),
                Action::make('generateWithAi')
                    ->label('Generate with AI')
                    ->schema([
                        Textarea::make('description')->required()->maxLength(4000)->rows(5)->helperText('Describe the site: shape, roofs, towers, colors, surroundings.'),
                        FileUpload::make('photos')
                            ->image()
                            ->multiple()
                            ->maxFiles(6)
                            ->maxSize(5120)
                            ->disk(config('filesystems.default'))
                            ->directory('references')
                            ->visibility('public')
                            ->helperText('Reference photos help the agent match proportions.'),
                    ])
                    ->action(function (array $data) use ($service): void {
                        $disk = Storage::disk(config('filesystems.default'));
                        $urls = array_map(fn (string $path) => $disk->url($path), array_values((array) ($data['photos'] ?? [])));
                        $service()->requestGeneration($this->getOwnerRecord(), $data['description'], $urls, auth()->user());
                        Notification::make()->title('Generation queued')->body('It can take a few minutes. The new version appears here as a draft.')->success()->send();
                    }),
                Action::make('uploadGlb')
                    ->label('Upload glb')
                    ->visible($isSuperAdmin)
                    ->schema([
                        FileUpload::make('glb')->required()->storeFiles(false)->maxSize(20480)->helperText('The builder converts materials to the palette and checks scale and budget.'),
                    ])
                    ->action(function (array $data) use ($service): void {
                        try {
                            $service()->uploadGlb($this->getOwnerRecord(), $data['glb']->get(), auth()->user());
                            Notification::make()->title('Model uploaded as a draft')->success()->send();
                        } catch (BuilderRejected $e) {
                            Notification::make()->title('The model was rejected')->body($e->getMessage())->danger()->send();
                        } catch (BuilderUnavailable) {
                            Notification::make()->title('The builder service is not available')->danger()->send();
                        }
                    }),
            ])
            ->recordActions([
                Action::make('approve')
                    ->requiresConfirmation()
                    ->color('success')
                    ->visible(fn (PlaceModel $record) => $isSuperAdmin() && $record->status === ModelStatus::Draft)
                    ->schema([Textarea::make('notes')->rows(2)])
                    ->action(fn (PlaceModel $record, array $data) => $service()->approve($record, auth()->user(), $data['notes'] ?? null)),
                Action::make('reject')
                    ->color('danger')
                    ->visible(fn (PlaceModel $record) => $isSuperAdmin() && $record->status === ModelStatus::Draft)
                    ->schema([Textarea::make('notes')->required()->rows(2)])
                    ->action(fn (PlaceModel $record, array $data) => $service()->reject($record, auth()->user(), $data['notes'])),
                Action::make('retry')
                    ->visible(fn (PlaceModel $record) => $record->status === ModelStatus::Failed && $record->source === 'kit')
                    ->action(function (PlaceModel $record): void {
                        $record->update(['status' => ModelStatus::Queued, 'failure_reason' => null]);
                        BuildPlaceModelJob::dispatch($record->id);
                    }),
                Action::make('viewSpec')
                    ->label('Document')
                    ->visible(fn (PlaceModel $record) => $record->spec !== null)
                    ->modalSubmitAction(false)
                    ->fillForm(fn (PlaceModel $record) => ['json' => json_encode($record->spec, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)])
                    ->schema([Textarea::make('json')->rows(20)->disabled()]),
            ]);
    }
}
