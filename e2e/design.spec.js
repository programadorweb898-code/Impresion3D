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
      const offers = document.querySelector('.offers-carousel')?.getBoundingClientRect();
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        promoBottom: promo.bottom,
        offersTop: offers?.top ?? Number.MAX_SAFE_INTEGER,
        promoWidth: promo.width,
      };
    });
    expect(bounds.pageWidth).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.promoWidth).toBeGreaterThan(240);
    expect(bounds.offersTop).toBeGreaterThanOrEqual(bounds.promoBottom - 1);
    await expect(page.locator('.hero')).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.custom-design-feature')
    .getByRole('link', { name: 'Solicitar diseño personalizado' }).click();
  await expect(page).toHaveURL('/disenar');
  await expect(page.getByRole('heading', { name: 'Tu idea, hecha a medida.' })).toBeVisible();
});


test('Diseño personalizado tiene textos horizontales y formulario amplio en móvil y escritorio', async ({ page }) => {
  await loginDesign(page);
  for (const width of [320, 390, 575, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/disenar');
    const layout = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const heading = document.querySelector('.photo-quote-page h1');
      const form = document.querySelector('.photo-quote-form');
      const input = document.querySelector('.photo-quote-form input[type="number"]');
      const aside = document.querySelector('.photo-quote-aside');
      const work = document.querySelector('.photo-quote-workspace').getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const asideRect = aside.getBoundingClientRect();
      return {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        heroWidth: rect('.photo-quote-hero').width,
        headingWidth: heading.getBoundingClientRect().width,
        headingMode: getComputedStyle(heading).writingMode,
        formWidth: formRect.width,
        inputWidth: input.getBoundingClientRect().width,
        formRight: formRect.right,
        asideLeft: asideRect.left,
        asideTop: asideRect.top,
        formBottom: formRect.bottom,
        workspaceColumns: getComputedStyle(document.querySelector('.photo-quote-workspace')).gridTemplateColumns,
        visibleTextElementsNarrow: [...document.querySelectorAll('.photo-quote-page h1, .photo-quote-page h2, .photo-quote-page h3')]
          .filter((node) => node.getBoundingClientRect().width < 150)
          .map((node) => node.textContent.trim()),
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.headingMode).toBe('horizontal-tb');
    expect(layout.headingWidth).toBeGreaterThan(250);
    expect(layout.formWidth).toBeGreaterThan(width <= 390 ? 270 : 400);
    expect(layout.inputWidth).toBeGreaterThan(170);
    if (width < 980) {
      expect(layout.asideTop).toBeGreaterThanOrEqual(layout.formBottom - 1);
    } else {
      expect(layout.asideLeft).toBeGreaterThanOrEqual(layout.formRight - 1);
    }
    expect(layout.visibleTextElementsNarrow, JSON.stringify(layout)).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator('.photo-quote-workspace').screenshot({
    path: test.info().outputPath('personalized-design-390.png'),
  });
});

test('la página invita a enviar una foto y exige iniciar sesión', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Diseño personalizado', exact: true }).click();
  await expect(page).toHaveURL('/disenar');
  await expect(page.getByRole('heading', { name: 'Tu idea, hecha a medida.' })).toBeVisible();
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
