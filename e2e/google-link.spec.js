import { test, expect } from '@playwright/test';

test('cuenta existente vincula Google desde perfil y después ingresa con el mismo usuario', async ({
  page,
  context,
}) => {
  await context.route('**/api/auth/google/start**', async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const authorization = new URL(response.headers().location);
    expect(authorization.hostname).toBe('accounts.google.com');
    const callback = new URL(authorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    callback.searchParams.set('code', 'isolated-google-code');
    await route.fulfill({
      response,
      headers: { ...response.headers(), location: callback.href },
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Mi perfil → Vincular Google',
  );
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('browser@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('NavegadorPrueba1!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL('/');
  const before = (await (await page.request.get('/api/auth/me')).json()).id;
  await page.goto('/perfil');
  const form = page.getByRole('form', { name: 'Vincular Google' });
  await expect(form.locator('..')).toContainText('browser@example.com');
  await form.getByLabel('Contraseña actual').fill('incorrecta');
  await form.getByRole('button', { name: 'Vincular Google' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'contraseña actual no es correcta',
  );
  await form.getByLabel('Contraseña actual').fill('NavegadorPrueba1!');
  await form.getByRole('button', { name: 'Vincular Google' }).click();
  await expect(page.getByRole('status')).toContainText('Google vinculado');
  await expect(
    page.getByRole('button', { name: 'Vincular Google', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.profile-current-email')).toContainText(
    'browser@example.com',
  );
  const csrf = (await (await page.request.get('/api/csrf')).json()).token;
  await page.request.post('/api/auth/logout', {
    headers: { Origin: 'http://127.0.0.1:3100', 'x-csrf-token': csrf },
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page).toHaveURL('/');
  expect((await (await page.request.get('/api/auth/me')).json()).id).toBe(
    before,
  );
});
