import { test, expect } from '@playwright/test';
import { loginDesign, openAdminQuotes } from './design-auth.js';
import { tetraStl } from '../apps/api/test/helpers/model-fixtures.js';

test('vincula PC, encola laminado y conserva la aprobación del precio en administración', async ({
  page,
  browser,
}) => {
  await openAdminQuotes(page);
  await page
    .getByRole('button', { name: 'Generar código de conexión', exact: true })
    .click();
  const code = await page.locator('.pairing-code').textContent();
  expect(code).toMatch(/^[A-F0-9]{18}$/);
  const secret = 'd'.repeat(64);
  const profiles = [
    { id: 'pla-prueba', name: 'A1 PLA de prueba', material: 'PLA' },
  ];
  const paired = await page.request.post('/api/slicer-worker/pair', {
    data: { code, secret, profiles },
  });
  expect(paired.status()).toBe(200);
  const { workerId } = await paired.json();
  const customerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const client = await customerContext.newPage();
  await loginDesign(client);
  await client.goto('/disenar');
  await client.getByLabel('Archivo de diseño 3D').setInputFiles({
    name: 'para-laminar.stl',
    mimeType: 'application/octet-stream',
    buffer: tetraStl(),
  });
  await expect(client.getByLabel('Ancho (cm)', { exact: true })).toBeVisible();
  await client.getByLabel('Cantidad', { exact: true }).fill('2');
  await client
    .getByRole('button', { name: 'Solicitar presupuesto', exact: true })
    .click();
  await client
    .getByRole('dialog')
    .getByRole('button', { name: 'Enviar', exact: true })
    .click();
  await expect(
    client.getByRole('status').filter({ hasText: /Solicitud #.*recibida/ }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Actualizar solicitudes', exact: true })
    .click();
  const row = page
    .locator('.design-request-row')
    .filter({ hasText: 'para-laminar.stl' })
    .first();
  await row
    .getByLabel('Perfil para para-laminar.stl', { exact: true })
    .selectOption(workerId + ':pla-prueba');
  await row
    .getByRole('button', { name: 'Laminar en mi PC', exact: true })
    .click();
  await expect(row).toContainText('En cola');
  const headers = { Authorization: 'Bearer ' + secret };
  const claim = await page.request.post('/api/slicer-worker/claim', {
    headers,
    data: {},
  });
  expect(claim.status()).toBe(200);
  const job = await claim.json();
  expect(job.quantity).toBe(2);
  const result = await page.request.post(
    '/api/slicer-worker/jobs/' + job.jobId + '/result',
    {
      headers: { ...headers, 'x-slicing-lease': job.lease },
      data: { ok: true, grams: 12, seconds: 3600, plates: 1 },
    },
  );
  expect(result.status()).toBe(204);
  await page
    .getByRole('button', { name: 'Actualizar solicitudes', exact: true })
    .click();
  await expect(row).toContainText('Laminado recibido');
  await expect(row).toContainText('24 g');
  const before = await (
    await client.request.get('/api/design-requests')
  ).json();
  const own = before.requests.find((r) => r.filename === 'para-laminar.stl');
  expect(own.priceCents).toBeNull();
  expect(own.status).toBe('recibido');
  await row
    .getByRole('button', { name: 'Usar estimación como borrador de precio' })
    .click();
  expect(
    Number(await row.getByLabel('Presupuesto total (ARS)').inputValue()),
  ).toBeGreaterThan(0);
  await row
    .getByRole('button', { name: 'Guardar respuesta', exact: true })
    .click();
  await expect(row).toContainText('Presupuestada');
  await page
    .getByRole('button', { name: 'Desconectar Mi PC', exact: true })
    .click();
  await expect(page.locator('.slicer-connections')).toContainText(
    'Desconectada',
  );
  expect(
    (
      await page.request.post('/api/slicer-worker/claim', { headers, data: {} })
    ).status(),
  ).toBe(401);
  await customerContext.close();
});
