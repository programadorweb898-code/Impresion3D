import { test, expect } from '@playwright/test';

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
              (nav) => nav.scrollWidth > nav.clientWidth && nav.scrollLeft > 0,
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
