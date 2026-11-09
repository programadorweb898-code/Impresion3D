import { test, expect } from '@playwright/test';

test('la navegación de escritorio no recorta Catálogo ni se superpone al logo', async ({
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
            return (
              Array.from(nav.children).every((link) => {
                const item = link.getBoundingClientRect();
                return (
                  item.left >= box.left - 1 &&
                  item.right <= box.right + 1 &&
                  item.left >= logo.right + 8 &&
                  item.right <= actions.left - 8
                );
              }) && nav.scrollWidth <= nav.clientWidth + 1
            );
          }),
        )
        .toBe(true);
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
