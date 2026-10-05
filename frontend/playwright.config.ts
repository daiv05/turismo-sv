import { defineConfig } from '@playwright/test';

const chromium = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    launchOptions: {
      ...(chromium ? { executablePath: chromium } : {}),
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
    },
  },
});
