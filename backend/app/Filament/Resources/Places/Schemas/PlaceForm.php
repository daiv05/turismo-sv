<?php

namespace App\Filament\Resources\Places\Schemas;

use App\Domain\Categories\Category;
use App\Domain\Places\PlaceStatus;
use App\Domain\Places\PlaceWorkflow;
use App\Filament\Support\SchemaFormBuilder;
use Closure;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Illuminate\Validation\Rule;

class PlaceForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('General')->columnSpanFull()->schema([
                Select::make('category_id')
                    ->label('Category')
                    ->options(fn () => Category::query()->orderBy('sort')->get()->mapWithKeys(fn (Category $c) => [$c->id => $c->name])->all())
                    ->required()
                    ->live()
                    ->searchable(),
                Select::make('zone_id')
                    ->label('Zone')
                    ->relationship('zone', 'slug')
                    ->searchable()
                    ->preload(),
                TextInput::make('slug')
                    ->required()
                    ->alphaDash()
                    ->maxLength(120)
                    ->unique('places', 'slug', ignoreRecord: true),
                TextInput::make('status')
                    ->disabled()
                    ->dehydrated(false)
                    ->formatStateUsing(fn ($state) => $state instanceof PlaceStatus ? $state->value : ($state ?? PlaceStatus::Draft->value)),
                Grid::make(2)->schema([
                    TextInput::make('name.es')->label('Name (ES)')->required()->maxLength(160),
                    TextInput::make('name.en')->label('Name (EN)')->maxLength(160),
                    Textarea::make('summary.es')->label('Summary (ES)')->rows(2)->maxLength(300),
                    Textarea::make('summary.en')->label('Summary (EN)')->rows(2)->maxLength(300),
                    Textarea::make('description.es')->label('Description (ES)')->rows(5),
                    Textarea::make('description.en')->label('Description (EN)')->rows(5),
                ]),
            ]),
            Section::make('Location')->columnSpanFull()->schema([
                Grid::make(2)->schema([
                    TextInput::make('lon')
                        ->label('Longitude')
                        ->numeric()
                        ->required()
                        ->minValue(-180)
                        ->maxValue(180)
                        ->rules([fn (Get $get): Closure => self::locationRule($get)]),
                    TextInput::make('lat')->label('Latitude')->numeric()->required()->minValue(-90)->maxValue(90),
                ]),
                TextInput::make('priority')->numeric()->integer()->default(0),
            ]),
            Section::make('Attributes')
                ->columnSpanFull()
                ->visible(fn (Get $get): bool => self::schemaFor($get('category_id')) !== [])
                ->schema(fn (Get $get): array => SchemaFormBuilder::components(self::schemaFor($get('category_id')))),
            Section::make('Opening hours')->columnSpanFull()->collapsed()->schema([
                KeyValue::make('opening_hours')->keyLabel('Day')->valueLabel('Hours'),
            ]),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function schemaFor(mixed $categoryId): array
    {
        if (! $categoryId) {
            return [];
        }

        return Category::query()->find($categoryId)?->attributes_schema ?? [];
    }

    private static function locationRule(Get $get): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($get): void {
            $lat = $get('lat');
            if ($value === null || $value === '' || $lat === null || $lat === '') {
                return;
            }
            if (! app(PlaceWorkflow::class)->canPlaceAt(auth()->user(), (float) $value, (float) $lat)) {
                $fail('This location is outside the zones you manage.');
            }
        };
    }
}
