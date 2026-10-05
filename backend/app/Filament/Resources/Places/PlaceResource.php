<?php

namespace App\Filament\Resources\Places;

use App\Domain\Places\Place;
use App\Filament\Resources\Places\Pages\CreatePlace;
use App\Filament\Resources\Places\Pages\EditPlace;
use App\Filament\Resources\Places\Pages\ListPlaces;
use App\Filament\Resources\Places\Schemas\PlaceForm;
use App\Filament\Resources\Places\Tables\PlacesTable;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class PlaceResource extends Resource
{
    protected static ?string $model = Place::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedMapPin;

    protected static ?string $recordTitleAttribute = 'slug';

    public static function form(Schema $schema): Schema
    {
        return PlaceForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PlacesTable::configure($table);
    }

    /**
     * Limits the records to those inside the zones of the signed in user and exposes their coordinates.
     */
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCoordinates()->visibleTo(auth()->user());
    }

    public static function getRelations(): array
    {
        return [RelationManagers\ModelsRelationManager::class];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPlaces::route('/'),
            'create' => CreatePlace::route('/create'),
            'edit' => EditPlace::route('/{record}/edit'),
        ];
    }
}
