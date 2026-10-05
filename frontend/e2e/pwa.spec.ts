import { expect, test } from '@playwright/test';

test.skip(!process.env.E2E_PRODUCTION, 'The service worker only registers in the production build');

test('installs the service worker, fills its caches and opens the shell offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByTestId('search')).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).sort())).toEqual(expect.arrayContaining(['assets-v1', 'shell-v1']));
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('tiles-v1')).keys()).length), { timeout: 20_000 }).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.goto('/');

  await expect(page.getByTestId('search')).toBeVisible();
  await expect(page.getByTestId('zoom-level')).toBeVisible();
});

test('serves a valid web app manifest', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();

  expect(manifest).toMatchObject({ name: 'Turismo SV', display: 'standalone', start_url: '/', theme_color: '#0F47AF' });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
});
