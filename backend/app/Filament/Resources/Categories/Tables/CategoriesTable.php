<?php

namespace App\Filament\Resources\Categories\Tables;

use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CategoriesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('slug')->searchable(),
                TextColumn::make('name'),
                TextColumn::make('kind')->badge()->formatStateUsing(fn ($state) => is_object($state) ? $state->value : $state),
                TextColumn::make('color_token')->badge(),
                TextColumn::make('min_zoom')->numeric(),
                TextColumn::make('sort')->numeric()->sortable(),
            ])
            ->recordActions([EditAction::make()])
            ->defaultSort('sort');
    }
}
