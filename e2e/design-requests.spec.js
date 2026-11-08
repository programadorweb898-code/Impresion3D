import { test, expect } from '@playwright/test';
import { loginDesign, openAdminQuotes } from './design-auth.js';
import { tetraStl } from '../apps/api/test/helpers/model-fixtures.js';
import { coloredThreeMf } from '../apps/api/test/helpers/three-mf-fixtures.js';

test('solicitud privada: proporciones, cancelar sin enviar, original descargable y presupuesto administrativo', async ({
  page,
  browser,
}) => {
  await loginDesign(page);
  await page.goto('/disenar');
  const bytes = tetraStl();
  await page.getByLabel('Archivo de diseño 3D').setInputFiles({
    name: 'pieza-pendiente.stl',
    mimeType: 'application/octet-stream',
    buffer: bytes,
  });
  await expect(page.getByLabel('Ancho (cm)', { exact: true })).toHaveValue(
    '0.1',
  );
  await page.getByLabel('Ancho (cm)', { exact: true }).fill('0.2');
  await page.getByLabel('Cantidad', { exact: true }).fill('3');
  await expect(page.getByLabel('Alto (cm)', { exact: true })).toHaveValue(
    '0.2',
  );
  await expect(
    page.getByLabel('Profundidad (cm)', { exact: true }),
  ).toHaveValue('0.2');
  await page
    .getByRole('button', { name: 'Solicitar presupuesto', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Hay partes sin color asignado');
  const warningBox = await dialog.boundingBox();
  expect(warningBox.y).toBeGreaterThan(0);
  expect(warningBox.height).toBeLessThan(800);
  await page.screenshot({
    path: '/workspace/scratch/b47d4206c37c/solicitud-aviso-color.png',
    fullPage: false,
  });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: /Solicitud #.*recibida/ }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Solicitar presupuesto', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /Solicitud #.*recibida/ }),
  ).toBeVisible();
  const row = page
    .locator('.design-request-row')
    .filter({ hasText: 'pieza-pendiente.stl' })
    .first();
  await expect(row).toContainText('3 unidad(es)');
  await expect(row).toContainText('0,2 × 0,2 × 0,2');
  const downloadUrl = await row
    .getByRole('link', { name: 'Descargar archivo original' })
    .getAttribute('href');
  const original = await page.request.get(downloadUrl);
  expect(await original.body()).toEqual(bytes);
  const adminContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const adminPage = await adminContext.newPage();
  await openAdminQuotes(adminPage);
  const adminRow = adminPage
    .locator('.design-request-row')
    .filter({ hasText: 'pieza-pendiente.stl' })
    .first();
  await adminRow
    .getByLabel('Estado de solicitud')
    .selectOption('presupuestado');
  await adminRow.getByLabel('Presupuesto total (ARS)').fill('4500');
  await adminRow
    .getByLabel('Respuesta al cliente')
    .fill('Precio por las tres unidades.');
  await adminRow.getByRole('button', { name: 'Guardar respuesta' }).click();
  await expect(adminRow).toContainText('Presupuestada');
  await page
    .getByRole('button', { name: 'Actualizar solicitudes', exact: true })
    .click();
  await expect(row).toContainText('4.500');
  await expect(row).toContainText('Precio por las tres unidades.');
  await adminContext.close();
});

test('blanco explícito no es falta de color; color parcialmente ausente y formatos desconocidos se distinguen', async ({
  page,
}) => {
  await loginDesign(page);
  await page.goto('/disenar');
  const input = page.getByLabel('Archivo de diseño 3D');
  const upload = async (name, buffer) => {
    await input.setInputFiles({
      name,
      mimeType: 'application/octet-stream',
      buffer,
    });
    await expect(page.getByLabel('Ancho (cm)', { exact: true })).toBeVisible();
  };
  await upload(
    'blanco.3mf',
    coloredThreeMf({
      transformXml: (x) => x.replace('#161616FF', '#FFFFFFFF'),
    }),
  );
  await page
    .getByRole('button', { name: 'Solicitar presupuesto', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: /Solicitud #.*recibida/ }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await upload(
    'parcial.3mf',
    coloredThreeMf({
      transformXml: (x) => x.replace(' pid="9" pindex="1"', ''),
    }),
  );
  await page
    .getByRole('button', { name: 'Solicitar presupuesto', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Hay partes sin color asignado',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await upload(
    'pintado-avanzado.3mf',
    coloredThreeMf({
      transformXml: (x) =>
        x.replace('<triangle ', '<triangle paint_color="ZZ" '),
    }),
  );
  await page
    .getByRole('button', { name: 'Solicitar presupuesto', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'No pudimos verificar todos los colores',
  );
});
