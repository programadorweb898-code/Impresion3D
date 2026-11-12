import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { loginDesign } from './design-auth.js';

const photo = () => sharp({
  create: { width: 160, height: 120, channels: 3, background: '#8244bb' },
}).png().toBuffer();


test('Home destaca la novedad con enlace directo sin tapar el hero, en móvil y escritorio', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const feature = page.locator('.custom-design-feature');
    await expect(feature).toBeVisible();
    await expect(feature.getByRole('heading', { name: /Hagámosla en 3D/ })).toBeVisible();
    const cta = feature.getByRole('link', { name: 'Solicitar diseño personalizado' });
    await expect(cta).toHaveAttribute('href', '/disenar');
    const bounds = await page.evaluate(() => {
      const promo = document.querySelector('.custom-design-feature').getBoundingClientRect();
      const hero = document.querySelector('.hero').getBoundingClientRect();
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        promoBottom: promo.bottom,
        heroTop: hero.top,
        promoWidth: promo.width,
      };
    });
    expect(bounds.pageWidth).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.promoWidth).toBeGreaterThan(240);
    expect(bounds.heroTop).toBeGreaterThanOrEqual(bounds.promoBottom - 1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.custom-design-feature')
    .getByRole('link', { name: 'Solicitar diseño personalizado' }).click();
  await expect(page).toHaveURL('/disenar');
  await expect(page.getByRole('heading', { name: 'Convertí tu idea en impresión 3D' })).toBeVisible();
});

test('la página invita a enviar una foto y exige iniciar sesión', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page.getByRole('link', { name: 'Diseño personalizado', exact: true }).click();
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
  const widthCheck = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    offenders: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName,
        className: typeof element.className === 'string' ? element.className : '',
        right: Math.round(element.getBoundingClientRect().right),
      })),
  }));
  expect(widthCheck.documentWidth, JSON.stringify(widthCheck.offenders)).toBeLessThanOrEqual(widthCheck.viewportWidth);
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
