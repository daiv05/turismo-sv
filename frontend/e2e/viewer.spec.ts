import { expect, test } from '@playwright/test';

test.describe('viewer', () => {
  test('loads the app shell, filters and the zoom indicator', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('search')).toBeVisible();
    await expect(page.getByTestId('chip-monuments')).toBeVisible();
    await expect(page.getByTestId('zoom-level')).toHaveText('country');
  });

  test('searches a place, opens its panel and offers directions', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('search').fill('catedral');
    await page.getByTestId('search-results').getByRole('option', { name: 'Catedral Metropolitana' }).click();

    const panel = page.getByTestId('place-panel');
    await expect(panel.getByRole('heading', { name: 'Catedral Metropolitana' })).toBeVisible();
    await expect(panel.getByRole('link', { name: /Google Maps/ })).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=13\.69888/);

    await panel.getByRole('button', { name: 'Cerrar' }).click();
    await expect(panel).toBeHidden();
  });

  test('switches the language of the panel', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.getByTestId('search').fill('cathedral');
    await page.getByTestId('search-results').getByRole('option', { name: 'Metropolitan Cathedral' }).click();

    await expect(page.getByTestId('place-panel').getByRole('heading', { name: 'Metropolitan Cathedral' })).toBeVisible();
    await expect(page.getByTestId('place-panel').getByRole('link', { name: /Directions/ })).toBeVisible();
  });

  test('requests only the cells it needs and filters by category', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/places?')) requests.push(decodeURIComponent(r.url()));
    });
    await page.goto('/');
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests.every((r) => /cell=0\//.test(r))).toBe(true);

    requests.length = 0;
    await page.getByTestId('chip-parks').click();
    await expect.poll(() => requests.some((r) => r.includes('categories=parks'))).toBe(true);
  });

  test('shows a message instead of crashing when the API is unreachable', async ({ page }) => {
    await page.route(/\/api\/(config|places|search|zones)/, (route) => route.abort());
    await page.goto('/');

    await expect(page.getByRole('status')).toContainText(/No pudimos conectar/);
    await expect(page.getByTestId('zoom-level')).toBeVisible();
  });

  test('opens a place directly from its deep link', async ({ page }) => {
    await page.goto('/lugar/palacio-nacional');

    await expect(page.getByTestId('place-panel').getByRole('heading', { name: 'Palacio Nacional' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/lugar/palacio-nacional');
  });

  test('keeps the address in sync with the selection and the back button', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('search').fill('teatro');
    await page.getByTestId('search-results').getByRole('option', { name: 'Teatro Nacional' }).click();
    await expect(page.getByTestId('place-panel')).toBeVisible();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/lugar/teatro-nacional');

    await page.goBack();
    await expect(page.getByTestId('place-panel')).toBeHidden();
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('shows a message for a deep link to a place that does not exist', async ({ page }) => {
    const response = await page.goto('/lugar/no-existe');

    if (response?.status() === 404) {
      await expect(page.getByRole('link', { name: /Volver al mapa/ })).toBeVisible();
    } else {
      await expect(page.getByRole('status')).toContainText(/ya no está disponible/);
    }
  });
});
