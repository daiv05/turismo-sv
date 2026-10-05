<?php

namespace App\Filament\Resources\Zones\Schemas;

use App\Domain\Zones\Zone;
use App\Domain\Zones\ZoneType;
use App\Support\GeoJsonCheck;
use Closure;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class ZoneForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Grid::make(2)->columnSpanFull()->schema([
                TextInput::make('slug')->required()->alphaDash()->maxLength(120)->unique('zones', 'slug', ignoreRecord: true),
                Select::make('type')->options(collect(ZoneType::cases())->mapWithKeys(fn ($t) => [$t->value => $t->value])->all())->required(),
                TextInput::make('name.es')->label('Name (ES)')->required()->maxLength(120),
                TextInput::make('name.en')->label('Name (EN)')->maxLength(120),
                Select::make('parent_id')
                    ->label('Parent zone')
                    ->options(fn (?Zone $record) => Zone::query()
                        ->when($record, fn ($q) => $q->whereKeyNot($record->getKey()))
                        ->orderBy('slug')->pluck('slug', 'id')->all())
                    ->searchable(),
            ]),
            Section::make('Camera')->columnSpanFull()->schema([
                Grid::make(3)->schema([
                    TextInput::make('camera.lon')->numeric()->minValue(-180)->maxValue(180),
                    TextInput::make('camera.lat')->numeric()->minValue(-90)->maxValue(90),
                    TextInput::make('camera.distance')->numeric()->minValue(0),
                ]),
            ]),
            Textarea::make('boundary_geojson')
                ->label('Boundary (GeoJSON Polygon or MultiPolygon)')
                ->columnSpanFull()
                ->rows(8)
                ->rules([fn (): Closure => function (string $attribute, mixed $value, Closure $fail): void {
                    if (filled($value) && ($problem = GeoJsonCheck::problem((string) $value))) {
                        $fail($problem);
                    }
                }]),
        ]);
    }
}
