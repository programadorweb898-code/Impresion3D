import { test, expect } from '@playwright/test';

test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.19.88.15' } });

test('el carrito cotiza entrega propia y guarda el total con envío', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Crear una cuenta', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente Entrega');
  await page.getByLabel('Correo electrónico', { exact: true })
    .fill('entrega-browser@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('EntregaPrueba1!');
  await page.getByRole('button', { name: 'Crear cuenta con email', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(20);
  await page.locator('.product-card').first()
    .getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
  await page.getByRole('button', { name: /Abrir carrito/ }).click();
  const cart = page.getByRole('dialog', { name: 'Tu carrito' });

  await expect(cart.getByRole('radio', { name: /Retiro coordinado/ })).toBeChecked();
  await expect(cart.locator('.delivery-total')).toContainText(['Gratis', 'Total a pagar']);
  await cart.getByRole('radio', { name: /Entrega a domicilio/ }).check();
  await expect(cart.locator('.delivery-total').last()).toContainText('—');
  await cart.getByLabel('Calle y altura').fill('Av. Rivadavia 1234');
  await cart.getByLabel('Localidad').fill('Morón');
  await cart.getByLabel('Código postal de destino').fill('1708');
  await cart.getByRole('button', { name: 'Calcular envío' }).click();
  await expect(cart).toContainText('Distancia de ida: 10 km');
  await expect(cart).toContainText('Recorrido ida y vuelta: 21 km');
  await expect(cart.locator('.delivery-total').last()).not.toContainText('—');

  const sent = page.waitForRequest((request) =>
    request.method() === 'POST' &&
    new URL(request.url()).pathname === '/api/orders');
  await cart.getByRole('button', { name: 'Enviar pedido', exact: true }).click();
  const body = (await sent).postDataJSON();
  expect(body.delivery).toEqual(expect.objectContaining({
    method: 'shipping',
    streetAddress: 'Av. Rivadavia 1234',
    city: 'Morón',
    postalCode: '1708',
    quoteId: expect.any(String),
  }));
  await expect(page.locator('main .order').first()).toContainText('Av. Rivadavia 1234');
  await expect(page.locator('main .order').first()).toContainText('Costo de entrega:');
  await expect(page.locator('main .order').first()).toContainText('Total:');
});
