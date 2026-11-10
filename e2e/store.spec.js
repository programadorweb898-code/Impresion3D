import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
test.beforeEach(async ({ page }, testInfo) => {
  const bytes = createHash('sha256').update(testInfo.testId).digest();
  await page.setExtraHTTPHeaders({
    'X-Forwarded-For': `198.18.${bytes[0]}.${bytes[1]}`,
  });
});
import { tetraGlb } from '../apps/api/test/helpers/model-fixtures.js';
test('enlaces anteriores de error permiten continuar con Facebook sin volver a exigir email', async ({
  page,
}) => {
  const starts = [];
  await page.route('**/api/auth/facebook/start**', (route) => {
    starts.push(new URL(route.request().url()));
    return route.fulfill({
      contentType: 'text/html',
      body: 'Ingreso de Facebook',
    });
  });
  for (const code of [
    'facebook_email',
    'facebook_email_permission',
    'facebook_email_account',
  ]) {
    await page.goto('/login?authError=' + code);
    await expect(page.getByRole('alert')).toContainText(
      'Podés continuar con Facebook aunque no comparta tu correo',
    );
    await expect(page).toHaveURL('/login');
    await page
      .getByRole('button', { name: 'Continuar con Facebook', exact: true })
      .click();
    await expect(page).toHaveURL('/api/auth/facebook/start');
    expect(starts.at(-1).searchParams.has('rerequest')).toBe(false);
  }
});
test('Facebook sin correo permite ingresar, comprar y confirmar un correo propio desde el perfil', async ({
  page,
}) => {
  // Run the real start endpoint, then substitute the provider's consent redirect.
  // State, cookies, callback, MongoDB and checkout are handled by the real app.
  await page.route('**/api/auth/facebook/start**', async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    expect(response.status()).toBe(302);
    const authorization = new URL(response.headers().location);
    expect(authorization.origin).toBe('https://www.facebook.com');
    const callback = new URL(authorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    callback.searchParams.set('code', 'browser-facebook-code');
    await route.fulfill({
      response,
      headers: { ...response.headers(), location: callback.href },
    });
  });
  await page.goto('/login');
  await page
    .getByRole('button', { name: 'Continuar con Facebook', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('button', { name: 'Abrir carrito, 0 productos' }),
  ).toBeEnabled();
  const original = await (await page.request.get('/api/auth/me')).json();
  expect(original.role).toBe('customer');
  expect(original.email).toBeUndefined();
  await page
    .locator('.product-card')
    .first()
    .getByRole('button', { name: 'Agregar al carrito' })
    .click();
  await page
    .getByRole('button', { name: 'Abrir carrito, 1 productos' })
    .click();
  await page
    .getByRole('button', { name: 'Enviar pedido', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Mis pedidos' }),
  ).toBeVisible();
  await page.goto('/perfil');
  await expect(
    page.getByText('Sin correo agregado', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Agregar email', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Nueva contraseña', { exact: true }),
  ).toHaveCount(0);
  // Cover the current production configuration too: no email delivery service yet.
  await page.route('**/api/profile', async (route) => {
    const response = await route.fetch();
    const profile = await response.json();
    await route.fulfill({
      response,
      json: { ...profile, canUpdateEmail: false },
    });
  });
  await page.reload();
  await expect(
    page.getByText('La confirmación por correo todavía no está disponible.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirmar nuevo email', exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: test.info().outputPath('mundo3d-facebook-perfil.png'),
    fullPage: true,
  });
  await page.unroute('**/api/profile');
  await page.reload();
  await page
    .getByLabel('Nombre', { exact: true })
    .fill('Nombre Facebook editado');
  await page.getByRole('button', { name: 'Guardar datos' }).click();
  await expect(page.getByRole('status')).toContainText('Datos actualizados');
  await page
    .getByLabel('Nuevo correo electrónico', { exact: true })
    .fill('facebook-browser-contact@example.com');
  await page.getByRole('button', { name: 'Confirmar nuevo email' }).click();
  await expect(page.getByRole('status')).toContainText('Enviamos un enlace');
  await expect(
    page.getByText('Sin correo agregado', { exact: true }),
  ).toBeVisible();
  const mail = await (
    await page.request.get(
      '/__test/mailbox/facebook-browser-contact@example.com',
    )
  ).json();
  await page.goto(mail.url);
  await page.getByRole('button', { name: 'Confirmar cambio de email' }).click();
  await expect(page.getByRole('status')).toContainText('Correo confirmado');
  await expect(page.locator('.profile-current-email')).toContainText(
    'facebook-browser-contact@example.com',
  );
  await expect(
    page.getByLabel('Nueva contraseña', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cerrar sesión', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Salir', exact: true })
    .click();
  await expect(page).toHaveURL('/login');
  await page
    .getByRole('button', { name: 'Continuar con Facebook', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  const returned = await (await page.request.get('/api/auth/me')).json();
  expect(returned.id).toBe(original.id);
  expect(returned.name).toBe('Nombre Facebook editado');
  expect(returned.email).toBe('facebook-browser-contact@example.com');
  const orders = await (await page.request.get('/api/orders')).json();
  expect(orders).toHaveLength(1);
  expect(orders[0].userId).toBe(original.id);
});
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
    .fill('NavegadorPrueba1!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Abrir carrito, ${count} productos` }),
  ).toBeEnabled();
}
test('la navegación sigue el flujo del sitio y permite usar el menú móvil', async ({
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
    expect((await header.boundingBox()).y).toBeLessThan(-100);
    await expect(page.locator('.site-header-spacer')).toHaveCount(0);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
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
        path: test.info().outputPath('impresion3d-flow-navbar.png'),
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
          return target.y;
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
    path: test.info().outputPath('impresion3d-toast-mobile.png'),
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
  await expect(page.locator('.model-stage')).toHaveCSS(
    'background-color',
    'rgb(37, 43, 51)',
  );
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
    .fill('NavegadorInicial1!');
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
    .fill('NavegadorFinal2!');
  await page
    .getByLabel('Confirmar contraseña', { exact: true })
    .fill('NavegadorFinal2!');
  await page
    .getByRole('button', { name: 'Confirmar correo y contraseña' })
    .click();
  await expect(page.getByRole('status')).toContainText('Correo confirmado');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('new-browser@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('NavegadorFinal2!');
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
test('ficha conserva fotos, descripción y medidas; galería adaptable a móvil y escritorio; volver y continuar comprando', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Especial', exact: true }).click();
  const link = page.getByRole('link', {
    name: 'Ver detalles de Pieza 00',
    exact: true,
  });
  await expect(link).toBeVisible();
  const card = page.locator('.product-card').filter({ has: link });
  await expect(card.locator('.description')).toHaveText(
    'Una pieza decorativa para tu espacio.',
  );
  await expect(card).not.toContainText(
    /100 × 100 × 100|\bmm\b|Descripción completa/,
  );
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
    'Ancho10 cm',
  );
  await expect(page.locator('.product-gallery-stage > img')).toHaveAttribute(
    'src',
    '/images/hero-3d-studio.svg',
  );
  await expect(page.locator('.gallery-thumbnails button')).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Ver foto: Girado 45°', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Ver foto: En uso', exact: true })
    .click();
  await expect(page.locator('.product-gallery-stage > img')).toHaveAttribute(
    'src',
    '/images/hero-3d-studio.svg?context',
  );
  await expect(page.locator('.product-gallery figcaption')).toContainText(
    '2 / 2',
  );
  await page
    .getByRole('button', { name: 'Foto siguiente', exact: true })
    .click();
  await expect(page.locator('.product-gallery-stage > img')).toHaveAttribute(
    'src',
    '/images/hero-3d-studio.svg',
  );
  await expect(page.locator('.product-gallery figcaption')).toContainText(
    '1 / 2',
  );
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const image = await page.locator('.product-detail-media').boundingBox();
    expect(image.width).toBeGreaterThan(
      width <= 900 ? Math.min(width * 0.8, 540) : width * 0.4,
    );
    expect(image.x).toBeGreaterThanOrEqual(0);
    expect(image.x + image.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.screenshot({
    path: test.info().outputPath('impresion3d-description-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath('impresion3d-description-mobile.png'),
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
  for (const prefix of ['descripci%C3%B3n', 'descripction', 'description']) {
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
    .fill('NavegadorPrueba1!');
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
test('privacidad y condiciones se abren desde el footer sin sesión y conservan navegación y contacto', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('footer')
    .getByRole('link', { name: 'Política de privacidad', exact: true })
    .click();
  await expect(page).toHaveURL(/\/politica-de-privacidad$/);
  await expect(
    page.getByRole('heading', { name: 'Política de privacidad', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Política de privacidad | Mundo 3D');
  await expect(page.locator('.legal-contact')).toContainText(
    'Luis Alberto Gómez',
  );
  await expect(page.locator('.legal-contact')).toContainText('Argentina');
  await expect(
    page
      .locator('.legal-contact')
      .getByRole('link', { name: 'somosmundo3d@gmail.com.ar', exact: true }),
  ).toHaveAttribute('href', 'mailto:somosmundo3d@gmail.com.ar');
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Solicitar eliminación de cuenta y datos' }),
  ).toHaveAttribute('href', /^mailto:somosmundo3d@gmail.com.ar\?subject=/);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath('mundo3d-privacidad-mobile.png'),
    fullPage: true,
  });
  await page
    .locator('footer')
    .getByRole('link', { name: 'Términos y condiciones', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Términos y condiciones', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle('Términos y condiciones | Mundo 3D');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Términos y condiciones', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Política de privacidad', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Volver a la página anterior', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(20);
  await expect(page.locator('.page-back')).toHaveCount(0);
  await expect(page).toHaveTitle('Mundo 3D · Ideas que toman forma');
  await page.goto('/login');
  await expect(page.locator('header,footer')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Política de privacidad', exact: true }),
  ).toHaveAttribute('href', '/politica-de-privacidad');
});
test('Google y visitantes pueden leer las páginas legales sin JavaScript ni autenticación', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    for (const [path, title] of [
      ['/politica-de-privacidad', 'Política de privacidad'],
      ['/terminos-y-condiciones', 'Términos y condiciones'],
    ]) {
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
      await expect(
        page.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible();
      await expect(page.locator('.legal-contact')).toContainText(
        'Luis Alberto Gómez',
      );
      await expect(page.locator('.legal-contact')).toContainText(
        'somosmundo3d@gmail.com.ar',
      );
      await expect(page).toHaveTitle(title + ' | Mundo 3D');
    }
    expect(await context.cookies()).toHaveLength(0);
  } finally {
    await context.close();
  }
});
test('new pages start at the top, while Back and Forward restore instantly before the first visible frame', async ({
  page,
}) => {
  const painted = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(20);
  await page.evaluate(() => {
    window.__navigationFrames = [];
    window.__recordNavigation = true;
    const record = () => {
      if (!window.__recordNavigation) return;
      if (!document.documentElement.hasAttribute('data-scroll-restoring'))
        window.__navigationFrames.push({
          path: location.pathname,
          title: document.querySelector('main h1')?.textContent,
          y: scrollY,
        });
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  const privacy = page
    .locator('footer')
    .getByRole('link', { name: 'Política de privacidad', exact: true });
  await privacy.scrollIntoViewIfNeeded();
  const homeY = await page.evaluate(() => scrollY);
  await privacy.click();
  await expect(
    page.getByRole('heading', { name: 'Política de privacidad', exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await painted();
  const terms = page
    .locator('footer')
    .getByRole('link', { name: 'Términos y condiciones', exact: true });
  await terms.scrollIntoViewIfNeeded();
  const privacyY = await page.evaluate(() => scrollY);
  await terms.click();
  await expect(
    page.getByRole('heading', { name: 'Términos y condiciones', exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await painted();
  await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }));
  const termsY = await page.evaluate(() => scrollY);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(privacyY);
  await painted();
  await page.goForward();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(termsY);
  await painted();
  await page.goBack();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(privacyY);
  await painted();
  await page.goBack();
  await expect(page.locator('.product-card')).toHaveCount(20);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(homeY);
  const frames = await page.evaluate(async () => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    window.__recordNavigation = false;
    return window.__navigationFrames;
  });
  for (const [path, title, expected] of [
    [
      '/politica-de-privacidad',
      'Política de privacidad',
      [0, privacyY, privacyY],
    ],
    ['/terminos-y-condiciones', 'Términos y condiciones', [0, termsY]],
  ]) {
    const entries = frames.filter(
      (frame, i) =>
        frame.path === path &&
        frame.title === title &&
        (i === 0 ||
          frames[i - 1].path !== path ||
          frames[i - 1].title !== title),
    );
    expect(entries.map((frame) => frame.y)).toEqual(expected);
  }
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
});

test('menú resalta la página activa; cancelar conserva sesión y confirmar salir abre login', async ({
  page,
}) => {
  await login(page);
  const nav = page.getByRole('navigation', { name: 'Principal' });
  let logoutRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/logout')
      logoutRequests++;
  });
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await expect(
    nav.getByRole('button', { name: 'Catálogo', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    nav.getByRole('button', { name: 'Catálogo', exact: true }),
  ).toHaveCSS('font-weight', '700');
  await nav.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mi perfil', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await expect(
    nav.getByRole('link', { name: 'Mi perfil', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    nav.getByRole('link', { name: 'Mi perfil', exact: true }),
  ).toHaveCSS('font-weight', '700');
  await expect(
    nav.getByRole('button', { name: 'Catálogo', exact: true }),
  ).not.toHaveAttribute('aria-current', 'page');
  await nav.getByRole('button', { name: 'Mis pedidos', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mis pedidos', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await expect(
    nav.getByRole('button', { name: 'Mis pedidos', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('cerrar sesión desde el perfil abre login', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mi perfil', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cerrar sesión', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '¿Querés cerrar sesión?', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: '¿Querés cerrar sesión?', exact: true })
    .getByRole('button', { name: 'Salir', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Qué bueno verte', exact: true }),
  ).toBeVisible();
});

test('confirmar identidad mantiene el perfil al aceptar, cancelar y cerrar la ventana', async ({
  page,
  context,
}) => {
  let consent = false;
  await context.route('**/api/auth/facebook/start**', async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const authorization = new URL(response.headers().location);
    const callback = new URL(authorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    const success = new URL(callback);
    success.searchParams.set('code', 'browser-code');
    const cancel = new URL(callback);
    cancel.searchParams.set('error', 'access_denied');
    if (!consent)
      return route.fulfill({
        response,
        headers: { ...response.headers(), location: success.href },
      });
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<a href="${success.href.replaceAll('&', '&amp;')}">Aceptar</a><a href="${cancel.href.replaceAll('&', '&amp;')}">Cancelar</a>`,
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continuar con Facebook' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/perfil');
  const confirm = page.getByRole('link', {
    name: 'Confirmar con Facebook',
    exact: true,
  });
  await expect(page.locator('.profile-current-email')).toBeVisible();
  await expect(confirm).toHaveCount(0);
  await page.request.post('/__test/expire-reauth');
  await page.reload();
  await expect(confirm).toBeVisible();
  consent = true;
  for (const outcome of ['cancel', 'close', 'accept']) {
    const opened = page.waitForEvent('popup');
    await confirm.click();
    const popup = await opened;
    await expect(page).toHaveURL('/perfil');
    await expect(popup.getByRole('link', { name: 'Aceptar' })).toBeVisible();
    if (outcome === 'close') await popup.close();
    else {
      const closed = popup.waitForEvent('close');
      await popup
        .getByRole('link', {
          name: outcome === 'accept' ? 'Aceptar' : 'Cancelar',
        })
        .click();
      await closed;
    }
    await expect(page.getByRole('status')).toContainText(
      outcome === 'accept' ? 'Identidad confirmada' : 'Confirmación cancelada',
    );
    await expect(page).toHaveURL('/perfil');
    if (outcome === 'accept') await expect(confirm).toHaveCount(0);
    else await expect(confirm).toBeVisible();
  }
});

test('Facebook recupera en el mismo intento una cookie omitida en el regreso externo', async ({
  page,
  context,
}) => {
  await context.route('**/api/auth/facebook/start**', async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const url = new URL(response.headers().location);
    const callback = new URL(url.searchParams.get('redirect_uri'));
    callback.searchParams.set('state', url.searchParams.get('state'));
    callback.searchParams.set('code', 'browser-code');
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<a href="${callback.href.replaceAll('&', '&amp;')}">Volver de Facebook</a>`,
    });
  });
  let omitted = 0,
    checked = 0;
  await context.route('**/api/auth/facebook/callback**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('returnCheck') === '1') {
      checked++;
      return route.continue();
    }
    omitted++;
    const response = await route.fetch({
      maxRedirects: 0,
      headers: { ...route.request().headers(), cookie: '' },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['set-cookie']).toBeUndefined();
    await route.fulfill({ response });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continuar con Facebook' }).click();
  await page.getByRole('link', { name: 'Volver de Facebook' }).click();
  await expect(page).toHaveURL('/');
  expect(omitted).toBe(1);
  expect(checked).toBe(1);
  expect((await (await page.request.get('/api/auth/me')).json()).role).toBe(
    'customer',
  );
});

test('administración convierte centímetros a milímetros y conserva decimales al reabrir', async ({
  page,
}) => {
  await login(page, 0, 'admin-browser@example.com');
  await menu(page, 'Administración');
  await page.getByRole('button', { name: 'Productos', exact: true }).click();
  const edit = page
    .locator('.admin-products > article')
    .first()
    .getByRole('button', { name: /^Editar / });
  await edit.click();
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('17');
  await page.getByLabel('Alto (cm)', { exact: true }).fill('12.12');
  await page.getByLabel('Profundidad (cm)', { exact: true }).fill('5.21');
  const saving = page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      r.url().includes('/api/admin/products/'),
  );
  await page
    .getByRole('button', { name: 'Guardar producto', exact: true })
    .click();
  const saved = await saving;
  expect(saved.ok()).toBeTruthy();
  expect(saved.request().postDataJSON().dimensions).toEqual({
    width: 170,
    height: 121.2,
    depth: 52.1,
  });
  await edit.click();
  await expect(page.getByLabel('Ancho (cm)', { exact: true })).toHaveValue(
    '17',
  );
  await expect(page.getByLabel('Alto (cm)', { exact: true })).toHaveValue(
    '12.12',
  );
  await expect(
    page.getByLabel('Profundidad (cm)', { exact: true }),
  ).toHaveValue('5.21');
});

test('catálogo y administración usan fondo oscuro con textos legibles', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('main.storefront-dark')).toBeVisible();
  expect(
    await page
      .locator('body')
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgb(0, 0, 0)');
  await login(page, 0, 'admin-browser@example.com');
  await menu(page, 'Administración');
  await expect(
    page.getByRole('heading', { name: 'Administración', exact: true }),
  ).toBeVisible();
  await expect(page.locator('main.storefront-dark')).toHaveCount(0);
  const colors = await page.locator('body').evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    text: getComputedStyle(el).color,
  }));
  expect(colors.background).toBe('rgb(0, 0, 0)');
  expect(colors.text).toBe('rgb(245, 245, 245)');
  const headingColor = await page
    .getByRole('heading', { name: 'Administración', exact: true })
    .evaluate((el) => getComputedStyle(el).color);
  expect(headingColor).toBe('rgb(245, 245, 245)');
});
