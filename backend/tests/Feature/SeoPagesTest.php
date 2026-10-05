<?php

use App\Domain\Places\Place;
use App\Domain\Places\PlaceStatus;
use App\Domain\Zones\Zone;
use App\Support\FrontendAssets;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config(['app.url' => 'https://turismo.test', 'filesystems.default' => 's3']);
    Storage::fake('s3');
    $this->withHeader('Accept-Language', '');
});

function monument(array $over = []): Place
{
    return Place::factory()->at(-89.19147, 13.69888)->create(array_merge([
        'slug' => 'catedral-metropolitana',
        'name' => ['es' => 'Catedral Metropolitana', 'en' => 'Metropolitan Cathedral'],
        'summary' => ['es' => 'Sede de la arquidiócesis.', 'en' => 'Seat of the archdiocese.'],
        'description' => ['es' => 'Descripción larga en español.', 'en' => 'Long description in English.'],
    ], $over));
}

it('serves an indexable place page with title, description and Open Graph tags', function () {
    monument();

    $html = $this->get('/lugar/catedral-metropolitana')->assertOk()->getContent();

    expect($html)->toContain('<title>Catedral Metropolitana · Turismo SV</title>')
        ->toContain('<meta name="description" content="Sede de la arquidiócesis.">')
        ->toContain('<meta property="og:title" content="Catedral Metropolitana">')
        ->toContain('<meta property="og:url" content="https://turismo.test/lugar/catedral-metropolitana">')
        ->toContain('<link rel="canonical" href="https://turismo.test/lugar/catedral-metropolitana">')
        ->toContain('<html lang="es">')
        ->toContain('Descripción larga en español.');
});

it('serves the page in English on request and links the alternates', function () {
    monument();

    $html = $this->get('/lugar/catedral-metropolitana?lang=en')->assertOk()->getContent();

    expect($html)->toContain('<title>Metropolitan Cathedral · Turismo SV</title>')->toContain('<html lang="en">')
        ->toContain('hreflang="es"')->toContain('hreflang="en"')->toContain('Long description in English.');
});

it('picks the language from the browser when none is requested', function () {
    monument();

    expect($this->get('/lugar/catedral-metropolitana', ['Accept-Language' => 'en-US,en;q=0.9'])->getContent())->toContain('<html lang="en">');
    expect($this->get('/lugar/catedral-metropolitana', ['Accept-Language' => 'fr-FR'])->getContent())->toContain('<html lang="es">');
});

it('describes the place for search engines with structured data', function () {
    monument();

    $html = $this->get('/lugar/catedral-metropolitana')->getContent();
    preg_match('#<script type="application/ld\+json">(.*?)</script>#s', $html, $m);
    $json = json_decode($m[1], true);

    expect($json['@type'])->toBe('TouristAttraction')
        ->and($json['name'])->toBe('Catedral Metropolitana')
        ->and($json['geo'])->toMatchArray(['@type' => 'GeoCoordinates', 'latitude' => 13.69888, 'longitude' => -89.19147]);
});

it('uses the model thumbnail as the share image when there is one', function () {
    $place = monument();
    $model = App\Domain\Places\PlaceModel::create(['place_id' => $place->id, 'version' => 1, 'source' => 'kit', 'status' => 'approved', 'glb_path' => 'models/1/v1/model.glb', 'thumbnail_paths' => ['models/1/v1/thumb-1.png']]);
    $place->update(['current_model_id' => $model->id]);

    expect($this->get('/lugar/catedral-metropolitana')->getContent())->toMatch('#<meta property="og:image" content="[^"]*models/1/v1/thumb-1\.png">#');
});

it('escapes content that could break out of the markup', function () {
    monument(['name' => ['es' => '"><script>alert(1)</script>'], 'summary' => ['es' => '</title><script>x</script>']]);

    $html = $this->get('/lugar/catedral-metropolitana')->getContent();

    expect($html)->not->toContain('<script>alert(1)</script>')->not->toContain('<script>x</script>');
});

it('hides unpublished places and unknown slugs', function () {
    monument(['status' => PlaceStatus::Draft]);

    $this->get('/lugar/catedral-metropolitana')->assertNotFound();
    $this->get('/lugar/no-existe')->assertNotFound();
});

it('serves a zone page listing its published places', function () {
    $zone = Zone::factory()->create(['slug' => 'centro-historico', 'name' => ['es' => 'Centro Histórico', 'en' => 'Historic Center']]);
    monument(['zone_id' => $zone->id]);
    Place::factory()->create(['zone_id' => $zone->id, 'status' => PlaceStatus::Draft, 'name' => ['es' => 'Oculto']]);

    $html = $this->get('/zona/centro-historico')->assertOk()->getContent();

    expect($html)->toContain('<title>Centro Histórico · Turismo SV</title>')->toContain('Catedral Metropolitana')->not->toContain('Oculto')
        ->toContain('href="/lugar/catedral-metropolitana"');
    $this->get('/zona/nada')->assertNotFound();
});

it('serves the app shell on the home page', function () {
    $this->get('/')->assertOk()->assertSee('id="app"', false);
});

describe('FrontendAssets', function () {
    it('builds script and style tags from the Vite manifest', function () {
        $dir = sys_get_temp_dir().'/fe-'.uniqid();
        mkdir("{$dir}/.vite", recursive: true);
        file_put_contents("{$dir}/.vite/manifest.json", json_encode(['index.html' => ['file' => 'assets/main-abc.js', 'isEntry' => true, 'css' => ['assets/main-def.css']]]));

        $tags = (new FrontendAssets($dir, '/app', null))->tags();

        expect($tags)->toContain('<script type="module" src="/app/assets/main-abc.js"></script>')->toContain('<link rel="stylesheet" href="/app/assets/main-def.css">');
    });

    it('points at the dev server when configured and no build exists', function () {
        $tags = (new FrontendAssets('/nonexistent', '/app', 'http://localhost:5173'))->tags();

        expect($tags)->toContain('http://localhost:5173/@vite/client')->toContain('http://localhost:5173/src/main.ts');
    });

    it('renders nothing instead of failing when neither exists', function () {
        expect((new FrontendAssets('/nonexistent', '/app', null))->tags())->toBe('');
    });
});

it('answers unknown places with a friendly page that is not indexed', function () {
    $response = $this->get('/lugar/no-existe')->assertNotFound();

    expect($response->getContent())->toContain('ya no está disponible')->toContain('href="/"')->toContain('noindex');
});
