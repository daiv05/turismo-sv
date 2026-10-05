<?php

namespace App\Http\Controllers;

use App\Domain\Places\Place;
use App\Domain\Zones\Zone;
use App\Support\FrontendAssets;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Server rendered pages for places and zones: indexable content and share metadata that the 3D app then takes over.
 */
final class PageController
{
    private const LOCALES = ['es', 'en'];

    public function home(Request $request): View
    {
        $locale = $this->locale($request);

        return view('seo.app', $this->shared($request, $locale, [
            'title' => 'Turismo SV',
            'description' => $locale === 'en' ? 'Explore El Salvador as a 3D toy diorama.' : 'Explora El Salvador como un diorama 3D.',
            'path' => '/',
        ]));
    }

    public function place(Request $request, string $slug): View
    {
        $locale = $this->locale($request);
        app()->setLocale($locale);
        $place = Place::query()->withCoordinates()->published()->where('places.slug', $slug)->with(['category', 'currentModel'])->firstOrFail();

        $thumbnail = $place->currentModel?->thumbnail_paths[0] ?? null;
        $image = $thumbnail ? Storage::disk(config('filesystems.default'))->url($thumbnail) : $this->absolute('/og-default.png');
        $summary = (string) ($place->summary ?: $place->description ?: '');

        return view('seo.place', $this->shared($request, $locale, [
            'title' => (string) $place->name,
            'description' => $summary,
            'path' => "/lugar/{$place->slug}",
            'image' => $image,
            'place' => $place,
            'jsonLd' => [
                '@context' => 'https://schema.org',
                '@type' => 'TouristAttraction',
                'name' => (string) $place->name,
                'description' => $summary,
                'image' => $image,
                'url' => $this->absolute("/lugar/{$place->slug}"),
                'geo' => ['@type' => 'GeoCoordinates', 'latitude' => (float) $place->lat, 'longitude' => (float) $place->lon],
            ],
        ]));
    }

    public function zone(Request $request, string $slug): View
    {
        $locale = $this->locale($request);
        app()->setLocale($locale);
        $zone = Zone::query()->where('slug', $slug)->firstOrFail();
        $places = Place::query()->published()->where('zone_id', $zone->id)->orderByDesc('priority')->limit(100)->get();

        return view('seo.zone', $this->shared($request, $locale, [
            'title' => (string) $zone->name,
            'description' => $locale === 'en' ? "Places to visit in {$zone->name}." : "Lugares para visitar en {$zone->name}.",
            'path' => "/zona/{$zone->slug}",
            'zone' => $zone,
            'places' => $places,
        ]));
    }

    private function locale(Request $request): string
    {
        $requested = $request->query('lang');
        if (in_array($requested, self::LOCALES, true)) {
            return $requested;
        }

        $header = (string) $request->header('Accept-Language', '');

        return $header === '' ? 'es' : ($request->getPreferredLanguage(self::LOCALES) ?? 'es');
    }

    private function absolute(string $path): string
    {
        return rtrim((string) config('app.url'), '/').$path;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function shared(Request $request, string $locale, array $data): array
    {
        return $data + [
            'locale' => $locale,
            'canonical' => $this->absolute($data['path']),
            'assets' => FrontendAssets::fromConfig()->tags(),
            'image' => $this->absolute('/og-default.png'),
        ];
    }
}
