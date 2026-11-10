import { openAdminQuotes } from './design-auth.js';
import { test, expect } from '@playwright/test';
import { zipArchive } from '../apps/api/test/helpers/three-mf-fixtures.js';
test('manual and sliced 3MF produce the same aggregate quote, missing statistics are rejected', async ({
  page,
}) => {
  await openAdminQuotes(page);
  await page
    .getByRole('button', { name: 'Presupuesto manual', exact: true })
    .click();
  await page.getByLabel('Filamento total (g)', { exact: true }).fill('100');
  await page.getByLabel('Horas de impresión', { exact: true }).fill('4');
  await page
    .getByRole('button', { name: 'Calcular presupuesto', exact: true })
    .click();
  await expect(page.locator('.quote-result')).toContainText('17.200');
  await page
    .getByRole('button', { name: 'Presupuesto automático', exact: true })
    .click();
  await expect(page.locator('.quote-result')).toHaveCount(0);
  const stats =
    '<config>' +
    [1, 2]
      .map(
        (i) =>
          '<plate><metadata key="index" value="' +
          i +
          '"/><metadata key="prediction" value="7200"/><metadata key="weight" value="50"/><filament used_g="50"/></plate>',
      )
      .join('') +
    '</config>';
  await page.getByLabel('Archivo 3MF laminado', { exact: true }).setInputFiles({
    name: 'laminado.3mf',
    mimeType: 'application/octet-stream',
    buffer: zipArchive({ 'Metadata/slice_info.config': stats }),
  });
  await expect(page.locator('.quote-result')).toContainText('17.200');
  await expect(page.locator('.quote-result')).toContainText('2 placa(s)');
  await page.getByLabel('Archivo 3MF laminado', { exact: true }).setInputFiles({
    name: 'sin-laminar.3mf',
    mimeType: 'application/octet-stream',
    buffer: zipArchive({ 'Metadata/slice_info.config': '<config/>' }),
  });
  await expect(page.locator('.design-quote [role="alert"]')).toContainText(
    'no contiene placas laminadas',
  );
  await expect(page.locator('.quote-result')).toHaveCount(0);
});

test('manual estimate changes with selected filament', async ({ page }) => {
  await openAdminQuotes(page);
  await page
    .getByRole('button', { name: 'Presupuesto manual', exact: true })
    .click();
  await page.getByLabel('Filamento total (g)', { exact: true }).fill('100');
  await page.getByLabel('Horas de impresión', { exact: true }).fill('4');
  for (const material of ['PLA', 'PETG', 'TPU']) {
    await page
      .getByLabel('Tipo de filamento', { exact: true })
      .selectOption(material);
    await expect(page.locator('.quote-result')).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Calcular presupuesto', exact: true })
      .click();
    await expect(page.locator('.quote-result')).toContainText(
      material === 'PLA' ? '17.200' : '17.000',
    );
    await expect(page.locator('.quote-result')).toContainText(material);
  }
});
