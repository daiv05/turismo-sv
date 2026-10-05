<?php

namespace App\Support;

/**
 * Script and style tags that mount the 3D app inside the server rendered pages. In production they come from the
 * Vite build manifest; in development they point at the Vite dev server.
 */
final class FrontendAssets
{
    public function __construct(
        private readonly string $buildDir,
        private readonly string $publicPath,
        private readonly ?string $devServer,
    ) {}

    public static function fromConfig(): self
    {
        return new self(public_path('app'), '/app', config('app.frontend_dev_url'));
    }

    public function tags(): string
    {
        $manifest = $this->buildDir.'/.vite/manifest.json';
        if (is_file($manifest)) {
            $entry = (json_decode((string) file_get_contents($manifest), true) ?? [])['index.html'] ?? null;
            if ($entry) {
                $tags = array_map(fn (string $css) => '<link rel="stylesheet" href="'.e($this->publicPath.'/'.$css).'">', $entry['css'] ?? []);
                $tags[] = '<script type="module" src="'.e($this->publicPath.'/'.$entry['file']).'"></script>';

                return implode("\n", $tags);
            }
        }

        if ($this->devServer) {
            $base = rtrim($this->devServer, '/');

            return '<script type="module" src="'.e($base).'/@vite/client"></script>'."\n".'<script type="module" src="'.e($base).'/src/main.ts"></script>';
        }

        return '';
    }
}
