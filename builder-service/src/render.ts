import { build } from 'esbuild';
import { chromium, type Browser } from 'playwright-core';
import { PALETTE } from '@turismo/kit/palette';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ANGLES = [-35, 35, 125] as const;

export interface RendererOptions {
  chromiumPath?: string | undefined;
}

let bundle: Promise<string> | null = null;

function pageBundle(): Promise<string> {
  bundle ??= build({
    entryPoints: [fileURLToPath(new URL('./page/page.ts', import.meta.url))],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    minify: true,
  }).then((result) => result.outputFiles[0]!.text);
  return bundle;
}

/**
 * Renders model thumbnails with a headless Chromium that loads the glb through the same Three.js and the
 * same material the viewer uses, so previews match what visitors will see.
 */
export class ThumbnailRenderer {
  private browser: Promise<Browser> | null = null;

  constructor(private readonly options: RendererOptions = {}) {}

  private launch(): Promise<Browser> {
    this.browser ??= chromium.launch({
      ...(this.options.chromiumPath ? { executablePath: this.options.chromiumPath } : {}),
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
    });
    return this.browser;
  }

  /**
   * @param glb Binary glTF of the model.
   * @param angles Camera yaw angles in degrees.
   * @param size Side of each square image in pixels.
   * @returns One PNG per angle.
   */
  async render(glb: Uint8Array, angles: readonly number[] = DEFAULT_ANGLES, size = 512): Promise<Buffer[]> {
    const browser = await this.launch();
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    try {
      await page.setContent('<!doctype html><html><body></body></html>');
      await page.addScriptTag({ content: await pageBundle() });
      const urls = await page.evaluate(
        ([b64, a, s, g]) => window.renderModel(b64 as string, a as number[], s as number, g as string),
        [Buffer.from(glb).toString('base64'), [...angles], size, PALETTE.ground] as const,
      );
      return urls.map((url) => Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64'));
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (!this.browser) return;
    const browser = await this.browser;
    this.browser = null;
    await browser.close();
  }
}
