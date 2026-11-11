import { expect } from '@playwright/test';
export async function quoteDelivery(page) {
  const cart = page.getByRole('dialog', { name: 'Tu carrito' });
  await cart.getByLabel('Calle y altura').fill('Av. Rivadavia 1234');
  await cart.getByLabel('Provincia', { exact: true }).selectOption('06');
  await cart
    .getByLabel('Localidad', { exact: true })
    .selectOption({ label: 'Morón — Morón' });
  await cart.getByLabel('Código postal de destino').fill('1708');
  await cart
    .getByRole('button', { name: 'Calcular envío', exact: true })
    .click();
  await expect(cart).toContainText('Distancia de ida: 10 km');
}
