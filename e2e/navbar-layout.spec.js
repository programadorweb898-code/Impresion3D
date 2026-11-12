import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
test.beforeEach(async ({ page }, testInfo) => {
  const hash = createHash('sha256').update(testInfo.testId).digest();
  await page.setExtraHTTPHeaders({
    'X-Forwarded-For': `198.19.${hash[0]}.${hash[1]}`,
  });
});


test('la navegación de escritorio permanece en una fila con desplazamiento horizontal', async ({
  page,
}) => {
  await page.goto('/');
  for (const signedIn of [false, true]) {
    if (signedIn) {
      await page.goto('/login');
      await page
        .getByLabel('Correo electrónico', { exact: true })
        .fill('admin-browser@example.com');
      await page
        .getByLabel('Contraseña', { exact: true })
        .fill('NavegadorPrueba1!');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Administración', exact: true }),
      ).toBeVisible();
    }
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(async () =>
          page.locator('.site-nav').evaluate((nav) => {
            const box = nav.getBoundingClientRect();
            const logo = document
              .querySelector('.site-header .brand')
              .getBoundingClientRect();
            const actions = document
              .querySelector('.header-actions')
              .getBoundingClientRect();
            const centers = Array.from(nav.children).map((link) => {
              const item = link.getBoundingClientRect();
              return item.top + item.height / 2;
            });
            return (
              Math.max(...centers) - Math.min(...centers) < 2 &&
              box.left >= logo.right + 8 &&
              box.right <= actions.left - 8 &&
              getComputedStyle(nav).overflowX === 'auto'
            );
          }),
        )
        .toBe(true);
      const links = page.locator('.site-nav > *');
      for (let i = 0; i < (await links.count()); i++) {
        await links.nth(i).scrollIntoViewIfNeeded();
        expect(
          await links.nth(i).evaluate((link) => {
            const item = link.getBoundingClientRect();
            const nav = link.parentElement.getBoundingClientRect();
            return item.left >= nav.left - 1 && item.right <= nav.right + 1;
          }),
        ).toBe(true);
      }
      if (signedIn && width === 1024) {
        expect(
          await page
            .locator('.site-nav')
            .evaluate(
              (nav) => nav.scrollWidth <= nav.clientWidth || nav.scrollLeft > 0,
            ),
        ).toBe(true);
      }
      await expect
        .poll(async () => {
          const main = await page.locator('main').boundingBox();
          const header = await page.locator('.site-header').boundingBox();
          return main.y + (await page.evaluate(() => scrollY)) - header.height;
        })
        .toBeGreaterThanOrEqual(-1);
      await page
        .getByRole('navigation', { name: 'Principal', exact: true })
        .getByRole('button', { name: 'Catálogo', exact: true })
        .click();
      await expect(page.locator('#catalogo')).toBeVisible();
    }
  }
  await page
    .locator('.site-header')
    .screenshot({ path: test.info().outputPath('desktop-navbar-admin.png') });
});


test('móvil muestra buscador entre logo y carrito y navega por categorías y FAQ', async ({ page }) => {
  for (const width of [320, 390, 575]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const search = page.getByRole('search').getByRole('searchbox', { name: 'Buscar productos' });
    await expect(search).toBeVisible();
    const positions = await page.evaluate(() => {
      const box = (selector) => document.querySelector(selector).getBoundingClientRect();
      return {
        logoRight: box('.site-header .brand').right,
        searchLeft: box('.header-product-search').left,
        searchRight: box('.header-product-search').right,
        cartLeft: box('.cart-icon-button').left,
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
      };
    });
    expect(positions.searchLeft).toBeGreaterThanOrEqual(positions.logoRight - 1);
    expect(positions.cartLeft).toBeGreaterThanOrEqual(positions.searchRight - 1);
    expect(positions.width).toBeLessThanOrEqual(positions.viewport);
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('button', { name: 'Categorías' }).click();
    await expect(page.locator('.nav-category-mobile-list')).toBeVisible();
    await expect(page.locator('.nav-category-mobile-list').getByRole('link', { name: 'Hogar' })).toBeVisible();
    await page.locator('.nav-category-mobile-list').getByRole('link', { name: 'Hogar' }).click();
    await expect(page).toHaveURL(/categoria=Hogar/);
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('link', { name: 'FAQ', exact: true }).click();
    await expect(page).toHaveURL('/faq');
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes', level: 1 })).toBeVisible();
  }
});

test('escritorio presenta categorías desplegables, FAQ y búsqueda reutilizable', async ({ page }) => {
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'FAQ', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Categorías' }).click();
    const popup = page.locator('.nav-category-popover');
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('link', { name: 'Todos los productos' })).toBeVisible();
    await popup.getByRole('link', { name: 'Hogar', exact: true }).click();
    await expect(page).toHaveURL(/categoria=Hogar/);
    await expect(popup).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Buscar productos' }).fill('Pieza 00');
    await expect(page.locator('.product-card')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'FAQ', exact: true }).click();
    await expect(page).toHaveURL('/faq');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes', level: 1 })).toBeVisible();
  }
  await page.goto('/preguntas-frecuentes');
  await expect(page.getByRole('heading', { name: 'Preguntas frecuentes', level: 1 })).toBeVisible();
});

test('los filtros avanzados quedan ocultos hasta pulsar el icono', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#catalog-filter-options')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar filtros' }).click();
  await expect(page.locator('#catalog-filter-options')).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar filtros' }).click();
  await expect(page.locator('#catalog-filter-options')).toHaveCount(0);
});
