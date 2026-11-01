import { test, expect } from '@playwright/test';
import { tetraGlb } from '../apps/api/test/helpers/model-fixtures.js';
async function menu(page, name) {
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('button', { name, exact: true })
    .click();
}
async function login(page, count = 0, email = 'browser@example.com') {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('browser-password-12345');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Abrir carrito, ${count} productos` }),
  ).toBeEnabled();
}
test('menú móvil, páginas y categorías incluyen piezas fuera de la primera página', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(20);
  await expect(page.locator('.product-card').first()).toContainText('100,50');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Especial', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await menu(page, 'Ingresar');
  await expect(
    page.getByRole('heading', { name: 'Qué bueno verte' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Volver al catálogo' }).click();
  await expect(page.locator('.site-header')).toBeVisible();
});
test('pedido con respuesta perdida conserva clave y comentarios al recargar; historial pagina', async ({
  page,
}) => {
  await login(page);
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  await page
    .getByRole('button', { name: 'Abrir carrito, 1 productos' })
    .click();
  await page
    .getByLabel('Comentarios para tu pedido')
    .fill('Azul después de recargar');
  let firstBody;
  await page.route('**/api/orders', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    firstBody = route.request().postDataJSON();
    await route.fetch();
    await route.abort('failed');
  });
  await page
    .getByRole('button', { name: 'Enviar pedido', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'conexión',
  );
  await page.unroute('**/api/orders');
  await page.reload();
  await page
    .getByRole('button', { name: 'Abrir carrito, 1 productos' })
    .click();
  await expect(page.getByLabel('Comentarios para tu pedido')).toHaveValue(
    'Azul después de recargar',
  );
  const sent = page.waitForRequest(
    (r) => r.url().endsWith('/api/orders') && r.method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Enviar pedido', exact: true })
    .click();
  expect((await sent).postDataJSON().requestId).toBe(firstBody.requestId);
  await expect(
    page.getByRole('heading', { name: 'Mis pedidos' }),
  ).toBeVisible();
  const history = await page.evaluate(() =>
    fetch('/api/orders?page=1').then((r) => r.json()),
  );
  expect(history.total).toBe(22);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.locator('.orders article.order')).toHaveCount(2);
  await expect(page.locator('.orders article.order').first()).toContainText(
    '100,50',
  );
});
test('carrito combina páginas y recupera disponibilidad al volver a iniciar sesión', async ({
  page,
}) => {
  await login(page);
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(5);
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  await page.evaluate(async () => {
    const { token } = await fetch('/api/csrf').then((r) => r.json());
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': token },
    });
  });
  await login(page, 2);
  await page
    .getByRole('button', { name: 'Abrir carrito, 2 productos' })
    .click();
  await expect(page.locator('.cart-item')).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Enviar pedido', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText('Producto no disponible', { exact: true }),
  ).toHaveCount(0);
});
test('visor WebGL carga geometría y permite cerrarlo y volver a abrirlo', async ({
  page,
}) => {
  await page.route('https://res.cloudinary.com/test/model.glb', (route) =>
    route.fulfill({
      contentType: 'model/gltf-binary',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: tetraGlb(),
    }),
  );
  const downloaded = [];
  page.on('request', (r) => downloaded.push(r.url()));
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(20);
  expect(
    downloaded.some(
      (url) =>
        url.includes('ProductViewer') ||
        url.includes('/Admin-') ||
        url.endsWith('model.glb'),
    ),
  ).toBe(false);
  const open = () =>
    page
      .locator('.product-card')
      .first()
      .getByRole('button', { name: 'Ver en 3D' })
      .click();
  await open();
  await expect(
    page.getByRole('button', { name: 'Restablecer vista' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Vista superior' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar visor 3D' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await open();
  await expect(
    page.getByRole('button', { name: 'Restablecer vista' }),
  ).toBeVisible();
});

test('registro por correo confirma un enlace y elige una contraseña antes de iniciar sesión', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await page
    .getByRole('button', { name: 'Crear una cuenta', exact: true })
    .click();
  await page.getByLabel('Nombre', { exact: true }).fill('Nuevo cliente');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('new-browser@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('initial-browser-password');
  await page.getByRole('button', { name: 'Crear cuenta con email' }).click();
  await expect(page.getByRole('status')).toContainText('Revisá tu correo');
  const response = await request.get('/__test/mailbox/new-browser@example.com');
  const mail = await response.json();
  await page.goto(mail.url);
  await expect(
    page.getByRole('heading', { name: 'Confirmá tu correo' }),
  ).toBeVisible();
  await expect(page).toHaveURL('/login');
  await page
    .getByLabel('Nueva contraseña', { exact: true })
    .fill('final-browser-password');
  await page
    .getByLabel('Confirmar contraseña', { exact: true })
    .fill('final-browser-password');
  await page
    .getByRole('button', { name: 'Confirmar correo y contraseña' })
    .click();
  await expect(page.getByRole('status')).toContainText('Correo confirmado');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('new-browser@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('final-browser-password');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Abrir carrito, 0 productos' }),
  ).toBeEnabled();
});
test('administración pagina productos y muestra integraciones sólo al administrador', async ({
  page,
}) => {
  await login(page, 0, 'admin-browser@example.com');
  await menu(page, 'Administración');
  await page.getByRole('button', { name: 'Productos', exact: true }).click();
  await expect(page.locator('.admin-products > article')).toHaveCount(20);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.locator('.admin-products > article')).toHaveCount(5);
  await page
    .getByRole('button', { name: 'Estado del servicio', exact: true })
    .click();
  await expect(
    page.getByText('Confirmación de correo: Habilitado'),
  ).toBeVisible();
  await expect(
    page.getByText('Avisos que agotaron sus reintentos: 0'),
  ).toBeVisible();
});
