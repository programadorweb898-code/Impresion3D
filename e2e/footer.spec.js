import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`footer y navegación informativa funcionan a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    const categories = footer.getByRole('navigation', {
      name: 'Explorá el catálogo',
    });
    await expect(
      categories.getByRole('link', { name: 'Especial', exact: true }),
    ).toBeVisible();
    await expect(
      categories.getByRole('link', { name: 'Hogar', exact: true }),
    ).toHaveAttribute('href', '/?categoria=Hogar#catalogo');
    await expect(footer.locator('address')).toContainText(
      'gomito724@gmail.com',
    );
    await expect(footer.locator('address a[href^="tel:"]')).toHaveAttribute(
      'href',
      'tel:+5491155606321',
    );
    await footer.getByText('¿Cómo hago un pedido?', { exact: true }).click();
    await expect(footer.locator('details[open]')).toContainText(
      'iniciá sesión',
    );
    await categories
      .getByRole('link', { name: 'Especial', exact: true })
      .click();
    await expect(page).toHaveURL('/?categoria=Especial#catalogo');
    await expect(page.locator('.grid-products > article')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.grid-products > article')).toHaveCount(1);
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Ver todas las preguntas' })
      .click();
    await expect(page).toHaveURL('/preguntas-frecuentes');
    await expect(
      page.getByRole('heading', { name: 'Preguntas frecuentes', level: 1 }),
    ).toBeVisible();
    await expect(page.locator('.faq-list details')).toHaveCount(6);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Preguntas frecuentes', level: 1 }),
    ).toBeVisible();
    if (width < 576)
      await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page
      .getByRole('navigation', { name: 'Principal', exact: true })
      .getByRole('link', { name: 'Sobre nosotros' })
      .click();
    await expect(page).toHaveURL('/sobre-nosotros');
    await expect(
      page.getByRole('heading', { name: 'Sobre nosotros', level: 1 }),
    ).toBeVisible();
    if (width < 576)
      await expect(
        page.getByRole('button', { name: 'Abrir menú' }),
      ).toHaveAttribute('aria-expanded', 'false');
    await page.reload();
    await expect(page).toHaveTitle('Sobre nosotros | Mundo 3D');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Consultá por tu diseño' }).click();
    await expect(page).toHaveURL('/disenar');
    await page.goBack();
    await expect(page).toHaveURL('/sobre-nosotros');
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Política de privacidad', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Política de privacidad', level: 1 }),
    ).toBeVisible();
    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Hogar', exact: true })
      .click();
    await expect(page.locator('.grid-products > article')).toHaveCount(20);
    await page.getByRole('contentinfo').screenshot({
      path: test.info().outputPath(`footer-${width}.png`),
    });
  });
}
