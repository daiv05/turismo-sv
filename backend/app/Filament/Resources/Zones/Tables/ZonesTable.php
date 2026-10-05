<?php

namespace App\Filament\Resources\Zones\Tables;

use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ZonesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('slug')->searchable(),
                TextColumn::make('name'),
                TextColumn::make('type')->badge()->formatStateUsing(fn ($state) => is_object($state) ? $state->value : $state),
                TextColumn::make('parent.slug')->label('Parent'),
            ])
            ->recordActions([EditAction::make()])
            ->defaultSort('slug');
    }
}
