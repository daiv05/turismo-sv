<?php

namespace App\Filament\Resources\Promotions\Schemas;

use App\Domain\Places\Place;
use Closure;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;

class PromotionForm
{
    public static function configure(Schema $schema): Schema
    {
        $templates = collect(config('promotions.templates'))->map(fn ($t) => $t['label'])->all();

        return $schema->components([
            Section::make('Offer')->columnSpanFull()->schema([
                Select::make('place_id')
                    ->label('Place')
                    ->required()
                    ->searchable()
                    ->getSearchResultsUsing(fn (string $search) => self::places()->where(fn ($q) => $q->whereRaw("places.name->>'es' ilike ?", ["%{$search}%"])->orWhereRaw("places.name->>'en' ilike ?", ["%{$search}%"]))->limit(30)->get()->mapWithKeys(fn (Place $p) => [$p->id => $p->name])->all())
                    ->getOptionLabelUsing(fn ($value) => Place::find($value)?->name)
                    ->options(fn () => self::places()->limit(50)->get()->mapWithKeys(fn (Place $p) => [$p->id => $p->name])->all())
                    ->rules([fn (): Closure => function (string $attribute, mixed $value, Closure $fail): void {
                        if (! self::places()->whereKey($value)->exists()) {
                            $fail('You cannot create promotions for this place.');
                        }
                    }]),
                Grid::make(2)->schema([
                    TextInput::make('title.es')->label('Title (ES)')->required()->maxLength(120),
                    TextInput::make('title.en')->label('Title (EN)')->maxLength(120),
                    Textarea::make('body.es')->label('Details (ES)')->rows(2)->maxLength(400),
                    Textarea::make('body.en')->label('Details (EN)')->rows(2)->maxLength(400),
                    DateTimePicker::make('starts_at')->required(),
                    DateTimePicker::make('ends_at')->required()->after('starts_at'),
                    TextInput::make('priority')->numeric()->integer()->default(0),
                    TextInput::make('status')->disabled()->dehydrated(false)->formatStateUsing(fn ($state) => is_object($state) ? $state->value : ($state ?? 'draft')),
                ]),
            ]),
            Section::make('Sprite')->columnSpanFull()->schema([
                Select::make('sprite_type')->options(['template' => 'Template', 'static' => 'Static image', 'spritesheet' => 'Spritesheet'])->default('template')->required()->live(),
                Select::make('template_key')->options($templates)->visible(fn (Get $get) => $get('sprite_type') === 'template')->required(fn (Get $get) => $get('sprite_type') === 'template')->live(),
                TextInput::make('template_data.value')->label('Percent')->numeric()->integer()->visible(fn (Get $get) => $get('sprite_type') === 'template' && $get('template_key') === 'percent-off'),
                TextInput::make('template_data.item')->label('Item')->maxLength(30)->visible(fn (Get $get) => $get('sprite_type') === 'template' && $get('template_key') === 'free-gift'),
                FileUpload::make('sprite_image')
                    ->image()
                    ->maxSize(2048)
                    ->disk(config('filesystems.default'))
                    ->directory('sprites')
                    ->visibility('public')
                    ->visible(fn (Get $get) => in_array($get('sprite_type'), ['static', 'spritesheet'], true))
                    ->helperText('PNG with transparency. A spritesheet lays its frames out on a grid.'),
                Grid::make(4)->visible(fn (Get $get) => $get('sprite_type') === 'spritesheet')->schema([
                    TextInput::make('sprite_frames')->numeric()->integer()->minValue(2)->maxValue(64),
                    TextInput::make('sprite_cols')->numeric()->integer()->minValue(1)->maxValue(16),
                    TextInput::make('sprite_rows')->numeric()->integer()->minValue(1)->maxValue(16),
                    TextInput::make('sprite_fps')->numeric()->integer()->minValue(1)->maxValue(30)->default(8),
                ]),
            ]),
        ]);
    }

    private static function places()
    {
        return Place::query()->visibleTo(auth()->user())->orderBy('places.id');
    }
}
