<?php

namespace App\Http\Controllers\Api;

use App\Domain\Categories\Category;
use App\Domain\Places\Place;
use App\Domain\Promotions\Promotion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SearchController
{
    private const LIMIT = 20;

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:80'],
            'locale' => ['nullable', 'in:es,en'],
        ]);
        $locale = $data['locale'] ?? 'es';
        app()->setLocale($locale);
        $needle = '%'.addcslashes($data['q'], '\\%_').'%';
        $matches = fn ($query, string $column) => $query->where(function ($q) use ($column, $locale, $needle) {
            $q->whereRaw("{$column}->>? ilike ?", [$locale, $needle]);
            if ($locale !== 'es') {
                $q->orWhere(fn ($fallback) => $fallback
                    ->whereRaw("coalesce({$column}->>?, '') = ''", [$locale])
                    ->whereRaw("{$column}->>'es' ilike ?", [$needle]));
            }
        });

        $places = $matches(Place::query()->published()->with('category'), 'places.name')
            ->orderByDesc('priority')->limit(self::LIMIT)->get();
        $categories = $matches(Category::query(), 'categories.name')->orderBy('sort')->limit(self::LIMIT)->get();
        $promotions = $matches(Promotion::query()->active()->with('place'), 'promotions.title')
            ->orderByDesc('priority')->limit(self::LIMIT)->get();

        return response()->json([
            'places' => $places->map(fn (Place $p) => [
                'slug' => $p->slug,
                'name' => $p->name,
                'category' => $p->category->slug,
            ])->values(),
            'categories' => $categories->map(fn (Category $c) => ['slug' => $c->slug, 'name' => $c->name])->values(),
            'promotions' => $promotions->map(fn (Promotion $p) => [
                'id' => $p->id,
                'title' => $p->title,
                'place_slug' => $p->place->slug,
            ])->values(),
        ]);
    }
}
