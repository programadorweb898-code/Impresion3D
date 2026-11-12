import { test, expect } from '@playwright/test';

test('catalog product Back link and browser Back restore the card and filters without intermediate scrolling', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(10);
  await page.getByRole('button', { name: 'Mostrar filtros' }).click();
  await page.getByLabel('Ordenar por').selectOption('price-desc');
  await expect(page.locator('.grid-products')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  const card = page.locator('.product-card').nth(7);
  const link = card.getByRole('link').first();
  await link.scrollIntoViewIfNeeded();
  const originalY = await page.evaluate(() => scrollY);
  const originalTop = await card.evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  const href = await link.getAttribute('href');
  await link.click();
  await expect(page).toHaveURL(href);
  await expect(page.locator('.product-details h1')).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole('link', { name: 'Volver a la página anterior' }).click();
  await expect(page.getByLabel('Ordenar por')).toHaveValue('price-desc');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(originalY);
  expect(
    await card.evaluate((el) => el.getBoundingClientRect().top),
  ).toBeCloseTo(originalTop, 0);
  await link.click();
  await expect(page).toHaveURL(href);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(originalY);
  // Re-enter the product with Forward: slow data must not expose the top first.
  await page.goForward();
  await expect(page.locator('.product-details h1')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-scroll-restoring',
  );
});

test('returning to a previous category waits for its content before revealing the saved position', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(10);
  const category = page
    .locator('footer')
    .getByRole('link', { name: 'Hogar', exact: true });
  await category.scrollIntoViewIfNeeded();
  const originalY = await page.evaluate(() => scrollY);
  await category.click();
  await expect(page).toHaveURL(/categoria=Hogar/);
  await expect(page.locator('.grid-products')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.route('**/api/products?*', async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ response });
  });
  await page.goBack();
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-scroll-restoring',
  );
  await expect(
    page.locator('.nav-category-trigger'),
  ).toHaveAttribute('data-selected-category', 'Todos');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(originalY);
  // Resolve any delayed intercepted requests before Playwright tears down the test.
  await page.unrouteAll({ behavior: 'wait' });
});
