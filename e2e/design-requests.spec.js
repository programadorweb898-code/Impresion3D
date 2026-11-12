import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { loginDesign, openAdminQuotes } from './design-auth.js';

const image = () => sharp({
  create: { width: 180, height: 130, channels: 3, background: '#cf4225' },
}).png().toBuffer();

async function upload(page, title) {
  await page.goto('/disenar');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'referencia.png',
    mimeType: 'image/png',
    buffer: await image(),
  });
  await page.getByLabel('Cantidad').fill('3');
  await page.getByLabel('Tamaño aproximado').fill('20 cm');
  await page.getByLabel('Detalles del pedido').fill(title);
}

test('la consulta por foto se administra y puede responderse manualmente por WhatsApp', async ({
  page, browser,
}) => {
  await loginDesign(page);
  await upload(page, 'Consulta de adorno personalizado en color rojo');
  await page.getByRole('radio', { name: 'WhatsApp' }).check();
  await expect(page.getByLabel('Tu número de WhatsApp')).toHaveAttribute('placeholder', '11 5555-5555');
  await page.getByLabel('Tu número de WhatsApp').fill('11 7000-1234');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Solicitar presupuesto' }).click();
  await expect(page.getByText(/Solicitud #.*recibida/).first()).toBeVisible();
  const personalRow = page.locator('.photo-quote-row')
    .filter({ hasText: 'Consulta de adorno personalizado en color rojo' }).first();
  await expect(personalRow.locator('img')).toBeVisible();

  const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const adminPage = await adminContext.newPage();
  await openAdminQuotes(adminPage);
  const adminRow = adminPage.locator('.photo-quote-row')
    .filter({ hasText: 'Consulta de adorno personalizado en color rojo' }).first();
  await expect(adminRow).toContainText('+5491170001234');
  await expect(adminRow.locator('img')).toBeVisible();
  await adminRow.getByLabel('Estado').selectOption('presupuestado');
  await adminRow.getByLabel('Presupuesto total (ARS)').fill('6500');
  await adminRow.getByLabel('Respuesta y condiciones').fill('Podemos realizarlo en color rojo.');
  await adminRow.getByRole('button', { name: 'Guardar presupuesto' }).click();
  await expect(adminRow).toContainText('6.500');
  const link = adminRow.getByRole('link', { name: 'Responder por WhatsApp' });
  await expect(link).toHaveAttribute('href', /wa\.me\/5491170001234/);
  expect(decodeURIComponent(await link.getAttribute('href'))).toContain('Podemos realizarlo en color rojo.');

  await page.getByRole('button', { name: 'Actualizar solicitudes' }).click();
  await expect(personalRow).toContainText('6.500');
  await expect(personalRow).toContainText('Podemos realizarlo en color rojo.');
  await adminContext.close();
});

test('la consulta por email conserva dirección y abre correo preparado para respuesta', async ({
  page, browser,
}) => {
  await loginDesign(page);
  await upload(page, 'Producto personalizado para cocina');
  await page.getByRole('radio', { name: 'Correo electrónico' }).check();
  await page.getByLabel('Tu correo electrónico').fill('respuesta-personal@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Solicitar presupuesto' }).click();
  await expect(page.getByText(/Solicitud #.*recibida/).first()).toBeVisible();

  const context = await browser.newContext();
  const adminPage = await context.newPage();
  await openAdminQuotes(adminPage);
  const adminRow = adminPage.locator('.photo-quote-row')
    .filter({ hasText: 'Producto personalizado para cocina' }).first();
  await expect(adminRow).toContainText('respuesta-personal@example.com');
  await adminRow.getByLabel('Estado').selectOption('presupuestado');
  await adminRow.getByLabel('Presupuesto total (ARS)').fill('7500');
  await adminRow.getByLabel('Respuesta y condiciones').fill('Precio sujeto a confirmación de tamaño.');
  await adminRow.getByRole('button', { name: 'Guardar presupuesto' }).click();
  const link = adminRow.getByRole('link', { name: 'Responder por email' });
  await expect(link).toHaveAttribute('href', /^mailto:/);
  const href = decodeURIComponent(await link.getAttribute('href'));
  expect(href).toContain('respuesta-personal@example.com');
  expect(href).toContain('7.500');
  await context.close();
});
