import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Connect, type Plugin } from 'vite';

const TILES_ROOT = fileURLToPath(new URL('../pipeline/out/', import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
};

/**
 * Serves the locally built tilesets under /tiles during development and preview, standing in for the CDN.
 */
function localTiles(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/tiles/')) return next();
    const file = resolve(TILES_ROOT, decodeURIComponent(url.pathname.slice('/tiles/'.length)));
    if (!file.startsWith(TILES_ROOT.endsWith(sep) ? TILES_ROOT : TILES_ROOT + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader('Content-Type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'local-tiles',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  plugins: [vue(), localTiles()],
  server: { host: '0.0.0.0', port: 5173 },
});
