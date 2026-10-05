<?php

namespace App\Filament\Resources\Categories\Schemas;

use App\Domain\Categories\CategoryKind;
use App\Support\JsonSchemaCheck;
use Closure;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;

class CategoryForm
{
    public static function configure(Schema $schema): Schema
    {
        $palette = collect(array_keys(config('palette')))->mapWithKeys(fn ($role) => [$role => $role])->all();

        return $schema->components([
            Grid::make(2)->columnSpanFull()->schema([
                TextInput::make('slug')->required()->alphaDash()->maxLength(80)->unique('categories', 'slug', ignoreRecord: true),
                TextInput::make('icon')->required()->maxLength(60),
                TextInput::make('name.es')->label('Name (ES)')->required()->maxLength(120),
                TextInput::make('name.en')->label('Name (EN)')->maxLength(120),
                Select::make('color_token')->options($palette)->required(),
                Select::make('kind')->options(collect(CategoryKind::cases())->mapWithKeys(fn ($k) => [$k->value => $k->value])->all())->required(),
                TextInput::make('min_zoom')->numeric()->integer()->minValue(0)->maxValue(3)->default(0)->required(),
                TextInput::make('sort')->numeric()->integer()->minValue(0)->default(0)->required(),
            ]),
            Textarea::make('attributes_schema')
                ->label('Attributes JSON Schema')
                ->columnSpanFull()
                ->rows(12)
                ->formatStateUsing(fn ($state) => is_array($state) ? json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : $state)
                ->dehydrateStateUsing(fn ($state) => filled($state) ? json_decode($state, true) : null)
                ->rules([fn (): Closure => function (string $attribute, mixed $value, Closure $fail): void {
                    if (filled($value) && ($problem = JsonSchemaCheck::problem((string) $value))) {
                        $fail($problem);
                    }
                }]),
        ]);
    }
}
