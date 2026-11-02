import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
test.beforeEach(async ({ page }, testInfo) => {
  const bytes = createHash('sha256').update(testInfo.testId).digest();
  await page.setExtraHTTPHeaders({
    'X-Forwarded-For': `198.18.${bytes[0]}.${bytes[1]}`,
  });
});
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
test('barra fija conserva carrito y menú al scrollear sin tapar contenido ni enlaces internos', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(20);
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    const header = page.locator('.site-header');
    await expect
      .poll(async () => {
        const headerBox = await header.boundingBox();
        const mainBox = await page.locator('main').boundingBox();
        return (
          mainBox.y + (await page.evaluate(() => scrollY)) - headerBox.height
        );
      })
      .toBeGreaterThanOrEqual(-1);
    await page.evaluate(() => scrollTo({ top: 1800, behavior: 'instant' }));
    expect((await header.boundingBox()).y).toBe(0);
    await expect(
      page.getByRole('button', { name: 'Abrir carrito, 0 productos' }),
    ).toBeInViewport();
    if (width === 390) {
      const position = await page.evaluate(() => scrollY);
      await page
        .getByRole('button', { name: 'Abrir menú', exact: true })
        .click();
      await expect(
        page.getByRole('navigation', { name: 'Principal' }),
      ).toBeVisible();
      expect(await page.evaluate(() => scrollY)).toBe(position);
      await page.screenshot({
        path: '/tmp/impresion3d-fixed-navbar.png',
        animations: 'disabled',
      });
      await page
        .getByRole('link', { name: 'Cómo funciona', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Abrir menú', exact: true }),
      ).toBeVisible();
      await expect
        .poll(async () => {
          const target = await page.locator('#proceso').boundingBox();
          const bar = await header.boundingBox();
          return target.y - bar.height;
        })
        .toBeGreaterThanOrEqual(0);
    }
  }
  await page.goto('/login');
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(page.locator('.site-header-spacer')).toHaveCount(0);
  await login(page, 0, 'admin-browser@example.com');
  await page.setViewportSize({ width: 390, height: 320 });
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  const profileLink = page.getByRole('link', {
    name: 'Mi perfil',
    exact: true,
  });
  await profileLink.scrollIntoViewIfNeeded();
  await expect(profileLink).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Abrir carrito, 0 productos' }),
  ).toBeInViewport();
  await profileLink.click();
  await expect(
    page.getByRole('heading', { name: 'Mi perfil', exact: true }),
  ).toBeVisible();
});
test('aviso del carrito sigue visible al scrollear, reemplaza mensajes y desaparece suavemente', async ({
  page,
}) => {
  await login(page);
  await page.clock.install();
  await page
    .locator('.product-card')
    .nth(10)
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  const toast = page.locator('.toast');
  await expect(toast).toContainText('Agregaste');
  await expect(toast).toHaveCSS('animation-name', 'toast-enter');
  await expect(toast).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  const before = await toast.boundingBox();
  expect(before.y).toBeGreaterThan(0);
  expect(before.y + before.height).toBeLessThan(844);
  await page.evaluate(() => scrollBy({ top: 120, behavior: 'instant' }));
  const after = await toast.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  await page.screenshot({
    path: '/tmp/impresion3d-toast-mobile.png',
    animations: 'disabled',
  });
  await page.clock.fastForward(1800);
  await page
    .locator('.product-card')
    .nth(11)
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  await expect(toast).toHaveCount(1);
  await expect(toast).not.toHaveClass(/is-closing/);
  await page.clock.fastForward(1300);
  await expect(toast).not.toHaveClass(/is-closing/);
  await page.clock.fastForward(1600);
  await expect(toast).toHaveClass(/is-closing/);
  await expect(toast).toHaveCSS('animation-name', 'toast-exit');
  await page.clock.fastForward(250);
  await expect(toast).toHaveCount(0);
});
test('aviso del carrito respeta movimiento reducido y permite cierre manual', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('.toast')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Cerrar notificación' }).click();
  await expect(page.locator('.toast')).toHaveCount(0);
});
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
  await page
    .getByRole('link', { name: 'Volver a la página anterior', exact: true })
    .click();
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

test('carrito espera disponibilidad sin alertas falsas al abrirlo y al agregar otra pieza', async ({
  page,
}) => {
  await login(page);
  let release;
  let pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/products?ids=*', async (route) => {
    await pending;
    await route.continue();
  });
  await page.evaluate(() => {
    window.cartAvailabilityWarnings = [];
    new MutationObserver(() => {
      for (const alert of document.querySelectorAll(
        '.cart-drawer [role="alert"]',
      )) {
        if (alert.textContent.includes('Quitá los productos'))
          window.cartAvailabilityWarnings.push(alert.textContent);
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  for (let i = 0; i < 2; i++) {
    if (i)
      pending = new Promise((resolve) => {
        release = resolve;
      });
    await page
      .locator('.product-card')
      .nth(i)
      .getByRole('button', { name: 'Agregar al carrito' })
      .click();
    await page
      .getByRole('button', { name: `Abrir carrito, ${i + 1} productos` })
      .click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('status')).toContainText(
      'Actualizando precios y disponibilidad',
    );
    await expect(drawer.getByRole('alert')).toHaveCount(0);
    await expect(
      drawer.getByRole('heading', {
        name: 'Producto no disponible',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      drawer.getByRole('button', { name: 'Enviar pedido', exact: true }),
    ).toBeDisabled();
    release();
    await expect(
      drawer.getByRole('button', { name: 'Enviar pedido', exact: true }),
    ).toBeEnabled();
    await expect(drawer.locator('.cart-item')).toHaveCount(i + 1);
    expect(await page.evaluate(() => window.cartAvailabilityWarnings)).toEqual(
      [],
    );
    await drawer.getByRole('button', { name: 'Cerrar carrito' }).click();
    await expect(drawer).toBeHidden();
  }
});

test('fallo de catálogo informa conexión sin marcar piezas como no disponibles y permite reintentar', async ({
  page,
}) => {
  await login(page);
  await page.route('**/api/products?ids=*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Servicio temporalmente no disponible' }),
    }),
  );
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  await page
    .getByRole('button', { name: 'Abrir carrito, 1 productos' })
    .click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('alert')).toContainText(
    'No pudimos actualizar el catálogo',
  );
  await expect(
    drawer.getByText(
      'Quitá los productos que ya no están disponibles para continuar.',
    ),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole('button', { name: 'Enviar pedido', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/api/products?ids=*');
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/products?ids=*', async (route) => {
    await pending;
    await route.continue();
  });
  await drawer
    .getByRole('button', { name: 'Actualizar catálogo', exact: true })
    .click();
  await expect(drawer.getByRole('status')).toContainText(
    'Actualizando precios y disponibilidad',
  );
  await expect(drawer.getByRole('alert')).toHaveCount(0);
  release();
  await expect(
    drawer.getByRole('button', { name: 'Enviar pedido', exact: true }),
  ).toBeEnabled();
});

test('la advertencia de disponibilidad se mantiene cuando el servidor confirma que falta una pieza', async ({
  page,
}) => {
  await login(page);
  await page.route('**/api/products?ids=*', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  await page
    .getByRole('button', { name: 'Abrir carrito, 1 productos' })
    .click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('alert')).toContainText(
    'Quitá los productos que ya no están disponibles',
  );
  await expect(
    drawer.getByRole('heading', {
      name: 'Producto no disponible',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    drawer.getByRole('button', { name: 'Enviar pedido', exact: true }),
  ).toBeDisabled();
});
test('ficha conserva fotos, descripción y medidas; imagen centrada 50vw; volver y continuar comprando', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Especial', exact: true }).click();
  const link = page.getByRole('link', {
    name: 'Ver detalles de Pieza 00',
    exact: true,
  });
  await expect(link).toBeVisible();
  const url = await link.getAttribute('href');
  await link.click();
  await expect(page).toHaveURL(new RegExp('/descripcion/[a-f0-9]{24}$'));
  await expect(
    page.getByRole('heading', { name: 'Pieza 00', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.product-detail-description')).toHaveText(
    'Producto de prueba\nDescripción completa conservada en la ficha.',
  );
  await expect(page.locator('.product-detail-dimensions')).toContainText(
    'Ancho100 mm',
  );
  await expect(page.locator('.product-detail-media img')).toHaveAttribute(
    'src',
    '/images/hero-3d-studio.svg',
  );
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const image = await page.locator('.product-detail-media').boundingBox();
    expect(Math.abs(image.width - width / 2)).toBeLessThan(2);
    expect(Math.abs(image.x + image.width / 2 - width / 2)).toBeLessThan(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.screenshot({
    path: '/tmp/impresion3d-description-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/impresion3d-description-mobile.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Continuar comprando', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Pieza 00', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Pieza 00', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Volver a la página anterior', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.goto(url);
  await page
    .getByRole('link', { name: 'Volver a la página anterior', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(20);
  for (const prefix of ['descripci%C3%B3n', 'descripction']) {
    await page.goto(url.replace('descripcion', prefix));
    await expect(
      page.getByRole('heading', { name: 'Pieza 00', exact: true }),
    ).toBeVisible();
  }
  await page.goto('/descripcion/invalid');
  await expect(
    page.getByRole('heading', { name: 'Producto no disponible' }),
  ).toBeVisible();
});
test('agregar desde ficha exige login, vuelve al producto y conserva carrito sin duplicados', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Especial', exact: true }).click();
  await page
    .getByRole('link', { name: 'Ver detalles de Pieza 00', exact: true })
    .click();
  const url = page.url();
  await page
    .getByRole('button', { name: 'Agregar al carrito', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Crear cuenta o iniciar sesión', exact: true })
    .click();
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(
    page.getByRole('link', {
      name: 'Volver a la página anterior',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('browser@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('browser-password-12345');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(url);
  await expect(
    page.getByRole('heading', { name: 'Pieza 00', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Agregar al carrito', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'En el carrito', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Abrir carrito, 1 productos', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Tu carrito' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Cerrar carrito', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Tu carrito' })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'En el carrito', exact: true }),
  ).toBeDisabled();
});
test('volver funciona en perfil, pedidos y administración sin salir del sitio', async ({
  page,
}) => {
  await login(page, 0, 'admin-browser@example.com');
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mi perfil', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Volver a la página anterior', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(20);
  await menu(page, 'Mis pedidos');
  await expect(
    page.getByRole('heading', { name: 'Mis pedidos', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Volver a la página anterior', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(20);
  await menu(page, 'Administración');
  await expect(
    page.getByRole('heading', { name: 'Administración', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Volver a la página anterior', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(20);
});
