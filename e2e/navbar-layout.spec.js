import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
test.beforeEach(async ({ page }, testInfo) => {
  const hash = createHash('sha256').update(testInfo.testId).digest();
  await page.setExtraHTTPHeaders({
    'X-Forwarded-For': `198.19.${hash[0]}.${hash[1]}`,
  });
});


test('cabecera conserva el buscador flexible en primera fila y el menú horizontal en segunda', async ({ page }) => {
  await page.goto('/');
  for (const signedIn of [false, true]) {
    if (signedIn) {
      await page.goto('/login');
      await page.getByLabel('Correo electrónico', { exact: true }).fill('admin-browser@example.com');
      await page.getByLabel('Contraseña', { exact: true }).fill('NavegadorPrueba1!');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Administración', exact: true })).toBeVisible();
    }
    for (const width of [320, 390, 575, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const state = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const row = rect('.site-header-top');
        const navRow = rect('.site-nav-row');
        const nav = document.querySelector('.site-nav');
        const centers = Array.from(nav.children).map((el) => {
          const r = el.getBoundingClientRect();
          return r.top + r.height / 2;
        });
        return {
          logoRight: rect('.site-header-top .brand').right,
          searchLeft: rect('.header-product-search').left,
          searchRight: rect('.header-product-search').right,
          searchWidth: rect('.header-product-search').width,
          cartLeft: rect('.site-header-top .cart-icon-button').left,
          topBottom: row.bottom,
          secondTop: navRow.top,
          navOverflow: getComputedStyle(nav).overflowX,
          rowSpread: Math.max(...centers) - Math.min(...centers),
          navScrollWidth: nav.scrollWidth,
          navClientWidth: nav.clientWidth,
          viewport: innerWidth,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      expect(state.searchLeft).toBeGreaterThanOrEqual(state.logoRight - 1);
      expect(state.cartLeft).toBeGreaterThanOrEqual(state.searchRight - 1);
      expect(state.searchWidth).toBeGreaterThan(width < 576 ? 120 : 200);
      expect(state.secondTop).toBeGreaterThanOrEqual(state.topBottom - 1);
      expect(state.navOverflow).toBe('auto');
      expect(state.rowSpread).toBeLessThan(3);
      expect(state.pageWidth).toBeLessThanOrEqual(state.viewport);
      if (width <= 390) expect(state.navScrollWidth).toBeGreaterThan(state.navClientWidth);
      const navLinks = page.locator('.site-nav > *');
      for (let index = 0; index < await navLinks.count(); index++) {
        await navLinks.nth(index).scrollIntoViewIfNeeded();
        expect(await navLinks.nth(index).evaluate((item) => {
          const r = item.getBoundingClientRect();
          const parent = item.parentElement.getBoundingClientRect();
          return r.left >= parent.left - 1 && r.right <= parent.right + 1;
        })).toBe(true);
      }
      await expect(page.getByRole('button', { name: 'Abrir menú', exact: true })).toHaveCount(0);
    }
  }
  await page.locator('.site-header').screenshot({ path: test.info().outputPath('two-row-navbar.png') });
});

test('categorías y FAQ se navegan desde la segunda fila en móvil y escritorio', async ({ page }) => {
  for (const width of [320, 390, 575, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Principal' })
      .getByRole('button', { name: 'Categorías' }).click();
    const categories = page.locator('.nav-category-popover');
    await expect(categories).toBeVisible();
    await expect(categories.getByRole('link', { name: 'Todos los productos' })).toBeVisible();
    await categories.getByRole('link', { name: 'Hogar', exact: true }).click();
    await expect(page).toHaveURL(/categoria=Hogar/);
    await expect(categories).toHaveCount(0);
    const search = page.getByRole('searchbox', { name: 'Buscar productos' });
    await search.fill('Pieza 00');
    await expect(page.locator('.product-card')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'FAQ', exact: true }).click();
    await expect(page).toHaveURL('/faq');
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes', level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
