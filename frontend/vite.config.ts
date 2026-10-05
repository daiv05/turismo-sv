import { createReadStream, existsSync, statSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Connect, type Plugin } from 'vite';

const TILES_ROOT = fileURLToPath(new URL('../pipeline/out/', import.meta.url));
const PUBLIC_ROOT = fileURLToPath(new URL('../backend/public/', import.meta.url));
const PWA_FILES = new Set(['/sw.js', '/manifest.webmanifest']);

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.js': 'text/javascript',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

/**
 * Streams a file that must live inside `root`, answering 404 for anything else.
 */
function sendFile(res: ServerResponse, file: string, root: string): void {
  const base = root.endsWith(sep) ? root : root + sep;
  if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader('Content-Type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  createReadStream(file).pipe(res);
}

/**
 * Serves the locally built tilesets under /tiles and the PWA files that live in the backend public folder,
 * standing in for the CDN and for Laravel during development and preview.
 */
function localAssets(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (PWA_FILES.has(url.pathname) || url.pathname.startsWith('/icons/')) {
        return sendFile(res, resolve(PUBLIC_ROOT, `.${decodeURIComponent(url.pathname)}`), PUBLIC_ROOT);
      }
      if (url.pathname.startsWith('/tiles/')) {
        return sendFile(res, resolve(TILES_ROOT, decodeURIComponent(url.pathname.slice('/tiles/'.length))), TILES_ROOT);
      }
    } catch {
      res.statusCode = 400;
      return void res.end();
    }
    next();
  };
  return {
    name: 'local-assets',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/' : '/',
  build: {
    outDir: '../backend/public/app',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: { index: fileURLToPath(new URL('./index.html', import.meta.url)), studio: fileURLToPath(new URL('./studio.html', import.meta.url)) } },
  },
  plugins: [vue(), localAssets()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:8000', changeOrigin: true } },
  },
}));
