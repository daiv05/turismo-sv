<?php

namespace App\Filament\Resources\Promotions;

use App\Domain\Promotions\Promotion;
use App\Filament\Resources\Promotions\Pages\CreatePromotion;
use App\Filament\Resources\Promotions\Pages\EditPromotion;
use App\Filament\Resources\Promotions\Pages\ListPromotions;
use App\Filament\Resources\Promotions\Schemas\PromotionForm;
use App\Filament\Resources\Promotions\Tables\PromotionsTable;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class PromotionResource extends Resource
{
    protected static ?string $model = Promotion::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    /**
     * Limits the records to promotions of places inside the zones of the signed in user.
     */
    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()->visibleTo(auth()->user());
    }

    /**
     * Turns the virtual form fields into columns and drops fields that do not apply to the chosen sprite type.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function normalize(array $data): array
    {
        $image = $data['sprite_image'] ?? null;
        unset($data['sprite_image']);
        $type = $data['sprite_type'] ?? 'template';

        $data['sprite_path'] = in_array($type, ['static', 'spritesheet'], true) ? (is_array($image) ? (array_values($image)[0] ?? null) : $image) : null;
        if ($type !== 'template') {
            $data['template_key'] = null;
            $data['template_data'] = null;
        } elseif (is_array($data['template_data'] ?? null)) {
            $data['template_data'] = array_filter($data['template_data'], fn ($v) => $v !== null && $v !== '');
        }
        if ($type !== 'spritesheet') {
            $data['sprite_frames'] = 1;
            $data['sprite_cols'] = 1;
            $data['sprite_rows'] = 1;
        }

        return $data;
    }

    public static function form(Schema $schema): Schema
    {
        return PromotionForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PromotionsTable::configure($table);
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
            'index' => ListPromotions::route('/'),
            'create' => CreatePromotion::route('/create'),
            'edit' => EditPromotion::route('/{record}/edit'),
        ];
    }
}
