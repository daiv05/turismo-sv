<?php

namespace App\Filament\Resources\Zones;

use App\Domain\Zones\Zone;
use App\Filament\Resources\Zones\Pages\CreateZone;
use App\Filament\Resources\Zones\Pages\EditZone;
use App\Filament\Resources\Zones\Pages\ListZones;
use App\Filament\Resources\Zones\Schemas\ZoneForm;
use App\Filament\Resources\Zones\Tables\ZonesTable;
use App\Support\Spatial;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class ZoneResource extends Resource
{
    protected static ?string $model = Zone::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function canAccess(): bool
    {
        return auth()->user()?->hasRole('super_admin') ?? false;
    }

    /**
     * Converts the GeoJSON text field into the geometry column expression, clearing the boundary when it is empty.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function withBoundary(array $data): array
    {
        $geojson = $data['boundary_geojson'] ?? null;
        unset($data['boundary_geojson']);
        $data['boundary'] = filled($geojson) ? Spatial::fromGeoJson(json_decode($geojson, true), multi: true) : null;

        return $data;
    }

    public static function form(Schema $schema): Schema
    {
        return ZoneForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return ZonesTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListZones::route('/'),
            'create' => CreateZone::route('/create'),
            'edit' => EditZone::route('/{record}/edit'),
        ];
    }
}
