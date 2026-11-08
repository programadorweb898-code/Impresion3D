import { test, expect } from '@playwright/test';

test('buscar agrupa pulsaciones, filtra precios y permite recuperar el catálogo', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(20);
  const searches = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/products' && url.searchParams.has('startsWith'))
      searches.push(url);
  });
  await page
    .getByLabel('Buscar productos', { exact: true })
    .pressSequentially('Pieza 00', { delay: 20 });
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'Pieza 00', exact: true }),
  ).toBeVisible();
  expect(searches).toHaveLength(1);
  expect(searches[0].searchParams.get('startsWith')).toBe('pieza 00');
  await page.getByText('Filtrar por precio', { exact: true }).click();
  await page.getByLabel('Precio máximo', { exact: true }).fill('100');
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Limpiar filtros', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(20);
  await expect(
    page.getByLabel('Buscar productos', { exact: true }),
  ).toHaveValue('');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    if (width === 1440) {
      const nav = page.getByRole('navigation', { name: 'Principal' });
      expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
        true,
      );
      await expect(
        page.getByRole('button', { name: 'Ingresar', exact: true }),
      ).toBeInViewport();
    }
  }
});


test('las pestañas reutilizan la búsqueda dinámica y permiten volver a buscar', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/products') requests.push(url);
  });
  await page.goto('/');
  const category = page.locator('.filters button').filter({ hasNotText: /^Todos$/ }).first();
  const label = (await category.textContent()).trim();
  await category.click();
  await expect.poll(() => requests.some((url) =>
    url.searchParams.get('startsWith') === label.toLowerCase() &&
    !url.searchParams.has('category'),
  )).toBe(true);
  await page.getByLabel('Buscar productos', { exact: true }).fill('Pieza 00');
  await expect(page.locator('.filters button').first()).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => requests.some((url) =>
    url.searchParams.get('startsWith') === 'pieza 00' &&
    !url.searchParams.has('category'),
  )).toBe(true);
});
