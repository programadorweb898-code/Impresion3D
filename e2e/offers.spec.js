import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`ofertas: precios, controles y consulta a ${width}px`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const carousel = page.getByRole('region', {
      name: 'Ofertas para darle forma a tus ideas.',
    });
    await carousel.scrollIntoViewIfNeeded();
    await carousel
      .getByRole('button', { name: 'Pausar ofertas automáticas' })
      .click();
    await expect(
      carousel.getByRole('button', { name: 'Activar ofertas automáticas' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.querySelector('.home-offers').nextElementSibling.id,
      ),
    ).toBe('catalogo');
    const active = carousel.locator('.offer-slide.is-active');
    await expect(active).toContainText('Bandeja navideña + 4 adornos');
    await expect(active).toContainText('$35.000');
    await expect(active).toContainText('Elegí los 4');
    await expect(active.locator('img')).toHaveCSS('object-fit', 'contain');
    await expect
      .poll(() =>
        active
          .locator('img')
          .evaluate((img) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    await expect(carousel.getByRole('link')).toHaveCount(1);
    if (width === 390) {
      await carousel.locator('.offers-stage').dispatchEvent('touchstart', {
        touches: [{ identifier: 0, clientX: 300, clientY: 200 }],
      });
      await carousel.locator('.offers-stage').dispatchEvent('touchend', {
        changedTouches: [{ identifier: 0, clientX: 80, clientY: 210 }],
      });
      await expect(active).toContainText('6 por $15.000');
      await carousel.locator('.offers-stage').dispatchEvent('touchstart', {
        touches: [{ identifier: 0, clientX: 80, clientY: 200 }],
      });
      await carousel.locator('.offers-stage').dispatchEvent('touchend', {
        changedTouches: [{ identifier: 0, clientX: 300, clientY: 210 }],
      });
      await expect(active).toContainText('Bandeja navideña + 4 adornos');
    }

    await carousel.getByRole('button', { name: 'Oferta siguiente' }).click();
    await expect(active).toContainText('6 por $15.000');
    await expect(active).toContainText('1 por $3.000');
    await carousel.getByRole('button', { name: 'Oferta siguiente' }).click();
    await expect(active).toContainText('Llevando 5 o más');
    await expect(active).toContainText('$2.000 c/u');
    await expect(active.getByRole('link')).toHaveAttribute(
      'href',
      '/descripction/oferta/llaveros',
    );
    await carousel.getByRole('button', { name: 'Oferta siguiente' }).click();
    await expect(active).toContainText('Bandeja navideña + 4 adornos');
    await carousel.getByRole('button', { name: 'Oferta anterior' }).click();
    await expect(active).toContainText('Llaveros para vos o para regalar');
    await carousel
      .getByRole('button', { name: 'Ver oferta 1:', exact: false })
      .click();
    await active.getByRole('link').focus();
    await page.keyboard.press('ArrowRight');
    await expect(active).toContainText('6 por $15.000');
    await carousel
      .getByRole('button', { name: 'Ver oferta 1:', exact: false })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await carousel.screenshot({
      path: test.info().outputPath(`ofertas-${width}.png`),
    });
  });
}

test('ofertas: bucle automático infinito, pausa y preferencias de movimiento', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  const carousel = page.locator('.home-offers');
  await carousel.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const active = carousel.locator('.offer-slide.is-active');
  await carousel.hover();
  await page.clock.runFor(300);
  for (const product of [
    'Bolas navideñas con efecto tejido',
    'Llaveros para vos o para regalar',
    'Bandeja navideña + 4 adornos',
  ]) {
    await page.clock.fastForward(6100);
    await expect(active).toContainText(product);
  }
  await carousel.getByRole('button', { name: 'Oferta siguiente' }).click();
  await page.clock.fastForward(6100);
  await expect(active).toContainText('Llaveros para vos o para regalar');
  await carousel
    .getByRole('button', { name: 'Ver oferta 1:', exact: false })
    .click();
  await carousel
    .getByRole('button', { name: 'Pausar ofertas automáticas' })
    .click();
  await page.clock.fastForward(18000);
  await expect(active).toContainText('Bandeja navideña + 4 adornos');
  await carousel
    .getByRole('button', { name: 'Activar ofertas automáticas' })
    .click();
  await page.evaluate(() => document.activeElement.blur());
  await page.mouse.move(0, 0);
  await page.clock.runFor(100);
  await page.clock.fastForward(6100);
  await expect(active).toContainText('Bolas navideñas con efecto tejido');
  await page.keyboard.press('Tab');
  await active.getByRole('link').focus();
  await page.clock.fastForward(18000);
  await expect(active).toContainText('Bolas navideñas con efecto tejido');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(
    carousel.getByRole('button', { name: 'Pausar ofertas automáticas' }),
  ).toBeVisible();
  await page.evaluate(() => document.activeElement.blur());
  await page.mouse.move(0, 0);
  await page.clock.runFor(100);
  await page.clock.fastForward(6100);
  await expect(active).toContainText('Llaveros para vos o para regalar');
  await expect(active).toHaveCSS('transition-duration', '0s');
});
