import { test, expect } from '@playwright/test';

test('catálogo muestra errores claros sin referencias internas ni códigos del servidor', async ({
  page,
}) => {
  for (const response of [
    {
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'No se pudo completar la operación' }),
      message: 'No se pudo completar la operación',
    },
    {
      status: 502,
      contentType: 'text/html',
      body: '<html>upstream internal details</html>',
      message:
        'El servicio no está disponible temporalmente. Esperá unos segundos y volvé a intentarlo.',
    },
    {
      status: 429,
      contentType: 'text/plain',
      body: 'Too many requests',
      message:
        'Hiciste varios intentos seguidos. Esperá unos minutos y volvé a intentarlo.',
    },
  ]) {
    await page.route('**/api/products?**', (route) =>
      route.fulfill({
        status: response.status,
        contentType: response.contentType,
        body: response.body,
        headers: { 'x-request-id': 'internal-diagnostic-12345' },
      }),
    );
    await page.goto('/');
    await expect(
      page.getByText(response.message, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /internal-diagnostic|upstream internal|HTTP 502|Too many requests/,
      ),
    ).toHaveCount(0);
    await page.unroute('**/api/products?**');
  }
});
