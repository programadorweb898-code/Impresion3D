import { test, expect } from '@playwright/test';

test('cart offers free pickup and saves shipping as pending, never as a free quotation', async ({
  page,
}) => {
  await page.goto('/login');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('browser@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('NavegadorPrueba1!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(20);
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito', exact: true })
    .click();
  await page.getByRole('button', { name: /Abrir carrito/ }).click();
  const cart = page.getByRole('dialog', { name: 'Tu carrito' });
  await expect(
    cart.getByRole('radio', { name: /Retirar en tienda/ }),
  ).toBeChecked();
  await expect(cart).toContainText('CP 1755');
  await expect(cart).toContainText('Dirección a coordinar al confirmar');
  await expect(cart.locator('.delivery-total')).toContainText('Retiro: gratis');
  await cart.getByRole('radio', { name: /^Envío/ }).check();
  await expect(cart.getByLabel('Código postal de destino')).toBeVisible();
  await expect(cart.locator('.delivery-total')).toContainText(
    'Subtotal sin envío',
  );
  await cart.getByLabel('Código postal de destino').fill('B1755ABC');
  const sent = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/orders',
  );
  await cart
    .getByRole('button', { name: 'Enviar pedido', exact: true })
    .click();
  expect((await sent).postDataJSON().delivery).toEqual({
    method: 'shipping',
    postalCode: 'B1755ABC',
  });
  await expect(page.locator('main .order').first()).toContainText(
    'Código postal B1755ABC',
  );
  await expect(page.locator('main .order').first()).toContainText(
    'Costo de envío a confirmar',
  );
  await expect(page.locator('main .order').first()).toContainText(
    'Productos (sin envío)',
  );
});
