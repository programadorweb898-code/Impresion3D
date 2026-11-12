import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { loginDesign } from './design-auth.js';

const photo = () => sharp({
  create: { width: 160, height: 120, channels: 3, background: '#8244bb' },
}).png().toBuffer();

test('la página invita a enviar una foto y exige iniciar sesión', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page.getByRole('link', { name: 'Presupuesto personalizado', exact: true }).click();
  await expect(page).toHaveURL('/disenar');
  await expect(page.getByRole('heading', { name: 'Convertí tu idea en impresión 3D' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Iniciá sesión para pedir tu presupuesto' })).toBeVisible();
  await expect(page.getByLabel('Archivo de diseño 3D')).toHaveCount(0);
});

test('con sesión acepta foto, tamaño y canal de respuesta, sin requerir archivos 3D', async ({ page }) => {
  await loginDesign(page);
  await page.goto('/disenar');
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'referencia.png',
    mimeType: 'image/png',
    buffer: await photo(),
  });
  await expect(page.locator('.photo-quote-preview')).toBeVisible();
  await page.getByLabel('Cantidad').fill('2');
  await page.getByLabel('Tamaño aproximado').fill('15 cm de alto');
  await page.getByLabel('Detalles del pedido').fill('Quiero conservar el color');
  await page.getByRole('radio', { name: 'WhatsApp' }).check();
  await page.getByLabel('Tu número de WhatsApp').fill('+5491155555555');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Solicitar presupuesto', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Solicitud #.*recibida/ })).toBeVisible();
  const item = page.locator('.photo-quote-row').first();
  await expect(item).toContainText('15 cm de alto');
  await expect(item).toContainText('WhatsApp');
  await expect(item.locator('img')).toBeVisible();
  const src = await item.locator('img').getAttribute('src');
  const response = await page.request.get(src);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/webp');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('el selector rechaza archivos distintos a fotografías y superiores a 5 MB', async ({ page }) => {
  await loginDesign(page);
  await page.goto('/disenar');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'modelo.3mf',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('no-model'),
  });
  await expect(page.getByRole('alert')).toContainText('JPG, PNG o WebP');
  await input.setInputFiles({
    name: 'grande.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0),
  });
  await expect(page.getByRole('alert')).toContainText('hasta 5 MB');
});
