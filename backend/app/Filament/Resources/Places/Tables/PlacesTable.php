<?php

namespace App\Filament\Resources\Places\Tables;

use App\Domain\Places\PlaceStatus;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class PlacesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')
                    ->searchable(query: fn (Builder $query, string $search) => $query
                        ->where(fn (Builder $q) => $q->whereRaw("places.name->>'es' ilike ?", ["%{$search}%"])->orWhereRaw("places.name->>'en' ilike ?", ["%{$search}%"]))),
                TextColumn::make('category.name')->label('Category'),
                TextColumn::make('zone.slug')->label('Zone'),
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
            ->filters([
                SelectFilter::make('status')->options(collect(PlaceStatus::cases())->mapWithKeys(fn ($s) => [$s->value => $s->value])->all()),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->defaultSort('id', 'desc');
    }
}
