import { quoteDelivery } from './shipping-helper.js';
import { test, expect } from '@playwright/test';

test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.19.88.15' } });

test('el carrito cotiza entrega propia y guarda el total con envío', async ({
  page,
}) => {
  await page.goto('/login');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('entrega-browser@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('NavegadorPrueba1!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(10);
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito', exact: true })
    .click();
  await page.getByRole('button', { name: /Abrir carrito/ }).click();
  const cart = page.getByRole('dialog', { name: 'Tu carrito' });

  await expect(cart.getByRole('radio')).toHaveCount(0);
  await expect(cart).not.toContainText('Retiro coordinado');
  await expect(
    cart.getByRole('button', { name: 'Enviar pedido', exact: true }),
  ).toBeDisabled();
  await quoteDelivery(page);
  await expect(
    cart.getByRole('option', { name: 'Merlo — Merlo', exact: true }),
  ).toHaveCount(1);
  await expect(cart).toContainText('Distancia de ida: 10 km');
  await expect(cart).toContainText('Recorrido ida y vuelta: 21 km');
  await expect(cart.locator('.delivery-total').last()).not.toContainText('—');

  await cart.getByLabel('Provincia', { exact: true }).selectOption('02');
  await expect(cart.getByLabel('Localidad', { exact: true })).toHaveValue('');
  await expect(cart.locator('.delivery-total').last()).toContainText('—');
  await expect(
    cart.getByRole('button', { name: 'Enviar pedido', exact: true }),
  ).toBeDisabled();
  await quoteDelivery(page);
  await cart.getByLabel('Buscar localidad', { exact: true }).fill('moron');
  await expect(cart.getByLabel('Localidad', { exact: true })).toContainText(
    'Morón',
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const actions = cart.locator('.cart-item-actions').first();
    const quantity = await actions.locator('label').boundingBox();
    const remove = await actions
      .getByRole('button', { name: /^Quitar/ })
      .boundingBox();
    expect(quantity && remove).toBeTruthy();
    expect(
      remove.x >= quantity.x + quantity.width + 10 ||
        remove.y >= quantity.y + quantity.height + 10,
    ).toBeTruthy();
  }
  const sent = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/orders',
  );
  await cart
    .getByRole('button', { name: 'Enviar pedido', exact: true })
    .click();
  const body = (await sent).postDataJSON();
  expect(body.delivery).toEqual(
    expect.objectContaining({
      method: 'shipping',
      streetAddress: 'Av. Rivadavia 1234',
      city: 'Morón',
      postalCode: '1708',
      quoteId: expect.any(String),
    }),
  );
  await expect(page.locator('main .order').first()).toContainText(
    'Av. Rivadavia 1234',
  );
  await expect(page.locator('main .order').first()).toContainText(
    'Costo de entrega:',
  );
  await expect(page.locator('main .order').first()).toContainText('Total:');
});
