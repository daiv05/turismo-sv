<?php

namespace App\Filament\Resources\Promotions\Tables;

use App\Domain\Places\PlaceStatus;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class PromotionsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title'),
                TextColumn::make('place.name')->label('Place'),
                TextColumn::make('starts_at')->dateTime()->sortable(),
                TextColumn::make('ends_at')->dateTime()->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn ($state) => $state instanceof PlaceStatus ? $state->value : $state)
                    ->color(fn ($state) => match ($state instanceof PlaceStatus ? $state : PlaceStatus::from($state)) {
                        PlaceStatus::Published => 'success',
                        PlaceStatus::InReview => 'warning',
                        PlaceStatus::Archived => 'gray',
                        PlaceStatus::Draft => 'info',
                    }),
                TextColumn::make('priority')->numeric()->sortable(),
            ])
            ->filters([SelectFilter::make('status')->options(collect(PlaceStatus::cases())->mapWithKeys(fn ($s) => [$s->value => $s->value])->all())])
            ->recordActions([EditAction::make()])
            ->defaultSort('starts_at', 'desc');
    }
}
