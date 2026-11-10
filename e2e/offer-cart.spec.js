import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ request, page }, testInfo) => {
  const bytes = createHash('sha256').update(testInfo.testId).digest();
  await page.setExtraHTTPHeaders({
    'X-Forwarded-For': `198.18.${bytes[0]}.${bytes[1]}`,
  });
  await request.post('/__test/offers');
});
test.afterEach(async ({ request }) => {
  await request.delete('/__test/offers');
});
async function login(page) {
  await page.goto('/login');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('offers-browser@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('NavegadorPrueba1!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Abrir carrito, 0 productos' }),
  ).toBeEnabled();
}
async function cart(page) {
  await page.getByRole('button', { name: /Abrir carrito/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
test('combo elige cuatro adornos, bloquea menos o más, guarda carrito y envía sus opciones al pedido', async ({
  page,
}) => {
  await login(page);
  await page.goto('/');
  const carousel = page.locator('.home-offers');
  await carousel.scrollIntoViewIfNeeded();
  await carousel.getByRole('link', { name: /Agregar esta oferta/ }).click();
  await expect(page).toHaveURL('/descripction/oferta/navidad-combo');
  await expect(
    page.getByRole('heading', {
      name: 'Bandeja navideña + 4 adornos',
      exact: true,
    }),
  ).toBeVisible();
  const checks = page.locator('.offer-options input[type="checkbox"]');
  await expect(checks).toHaveCount(5);
  await expect(page.locator('.offer-options input:checked')).toHaveCount(0);
  const add = page.getByRole('button', {
    name: 'Agregar al carrito',
    exact: true,
  });
  await expect(add).toBeDisabled();
  for (let i = 0; i < 3; i++) await checks.nth(i).check();
  await expect(add).toBeDisabled();
  await checks.nth(3).check();
  await expect(add).toBeEnabled();
  await expect(checks.nth(4)).toBeDisabled();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator('.offer-details').screenshot({
      path: test.info().outputPath(`combo-opciones-${width}.png`),
    });
  }
  await page.setViewportSize({ width: 390, height: 900 });

  await checks.nth(0).uncheck();
  await expect(add).toBeDisabled();
  await checks.nth(0).check();
  await add.click();
  await expect(
    page.getByRole('button', { name: 'Actualizar selección del carrito' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('.offer-options input:checked')).toHaveCount(4);
  await cart(page);
  await expect(page.getByRole('dialog')).toContainText('35.000');
  await expect(
    page.getByRole('dialog').locator('.cart-offer-selection'),
  ).toContainText('tejido');
  await page.getByRole('link', { name: 'Editar selección' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.offer-options input:checked')).toHaveCount(4);
  await page
    .getByRole('button', { name: 'Continuar comprando', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  await cart(page);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Enviar pedido', exact: true })
    .click();
  const order = await (await response).json();
  expect(order.totalCents).toBe(3500000);
  expect(order.items[0].offer.selections).toHaveLength(4);
  await expect(
    page.getByRole('heading', { name: 'Mis pedidos', exact: true }),
  ).toBeVisible();
});
test('bolas seleccionan colores y cantidad exacta; llaveros aplican precio por cantidad en el carrito mixto', async ({
  page,
}) => {
  await login(page);
  await page.goto('/descripction/oferta/navidad-bolas');
  await expect(page.locator('.offer-option-check')).toHaveCount(6);
  const add = page.getByRole('button', {
    name: 'Agregar al carrito',
    exact: true,
  });
  await page
    .getByRole('checkbox', { name: 'Elegir Rojo', exact: true })
    .check();
  await page.getByLabel('Cantidad de Rojo', { exact: true }).selectOption('6');
  await expect(add).toBeEnabled();
  await page.getByLabel('Cantidad de Rojo', { exact: true }).selectOption('8');
  await expect(page.locator('.offer-detail-total')).toContainText('20.000');
  await page.getByLabel('Cantidad de Rojo', { exact: true }).selectOption('6');
  await add.click();
  await page.goto('/descripction/oferta/llaveros');
  await page
    .getByRole('checkbox', { name: 'Elegir Llavero Malvinas', exact: true })
    .check();
  await page
    .getByLabel('Cantidad de Llavero Malvinas', { exact: true })
    .selectOption('5');
  await expect(page.locator('.offer-detail-total')).toContainText('10.000');
  await add.click();
  await cart(page);
  await expect(page.getByRole('dialog')).toContainText('25.000');
  await expect(page.getByRole('dialog')).toContainText('Rojo × 6');
  await page.getByRole('link', { name: 'Editar selección' }).first().click();
  await expect(page).toHaveURL('/descripction/oferta/navidad-bolas');
  await expect(page.locator('.offer-options input:checked')).toHaveCount(1);
  await page.getByRole('radio', { name: '1 a 5 bolas · $3.000 c/u' }).check();
  await expect(
    page.getByRole('button', { name: 'Actualizar selección del carrito' }),
  ).toBeDisabled();
  await page
    .getByRole('checkbox', { name: 'Elegir Dorado metalizado', exact: true })
    .check();
  await page
    .getByRole('button', { name: 'Actualizar selección del carrito' })
    .click();
  await cart(page);
  await expect(page.getByRole('dialog')).toContainText('13.000');
  await expect(page.getByRole('dialog')).toContainText('Dorado metalizado × 1');
});
test('visitante conserva el borrador al iniciar sesión y puede abrir oferta inválida sin romper la página', async ({
  page,
}) => {
  await page.goto('/descripction/oferta/navidad-combo');
  const checks = page.locator('.offer-options input[type="checkbox"]');
  await expect(checks).toHaveCount(5);
  for (let i = 0; i < 4; i++) await checks.nth(i).check();
  await page
    .getByRole('button', { name: 'Agregar al carrito', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Crear cuenta o iniciar sesión' })
    .click();
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('offers-browser@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('NavegadorPrueba1!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL('/descripction/oferta/navidad-combo');
  await expect(page.locator('.offer-options input:checked')).toHaveCount(4);
  await page
    .getByRole('button', { name: 'Agregar al carrito', exact: true })
    .click();
  await cart(page);
  await expect(page.getByRole('dialog')).toContainText('35.000');
  await page.goto('/descripction/oferta/no-existe');
  await expect(
    page.getByRole('heading', { name: 'Oferta no disponible' }),
  ).toBeVisible();
});
