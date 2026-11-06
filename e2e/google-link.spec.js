import { test, expect } from '@playwright/test';

test('Google confirma la cuenta durante el login y después permite acceso directo', async ({
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
  await expect(
    page.getByRole('heading', { name: 'Confirmá que sos vos' }),
  ).toBeVisible();
  await expect(page.locator('.auth-intro')).toContainText(
    'browser@example.com',
  );
  await page.reload();
  const form = page.getByRole('form', { name: 'Confirmar acceso con Google' });
  await form.getByLabel('Contraseña de tu cuenta').fill('incorrecta');
  await form
    .getByRole('button', { name: 'Confirmar y continuar con Google' })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'contraseña no es correcta',
  );
  await form.getByLabel('Contraseña de tu cuenta').fill('NavegadorPrueba1!');
  await form
    .getByRole('button', { name: 'Confirmar y continuar con Google' })
    .click();
  await expect(page).toHaveURL('/');
  const before = (await (await page.request.get('/api/auth/me')).json()).id;
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
