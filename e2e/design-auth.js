import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
export async function loginDesign(page, email = 'browser@example.com') {
  const ip = createHash('sha256').update(test.info().testId).digest();
  await page
    .context()
    .setExtraHTTPHeaders({ 'X-Forwarded-For': `198.19.${ip[0]}.${ip[1]}` });
  await page.goto('/login');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('NavegadorPrueba1!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Abrir carrito, 0 productos' }),
  ).toBeEnabled();
}
export async function openAdminQuotes(page) {
  await loginDesign(page, 'admin-browser@example.com');
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page
    .getByRole('button', { name: 'Administración', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Presupuestos', exact: true })
    .click();
}
