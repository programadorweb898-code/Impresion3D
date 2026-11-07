import { test, expect } from '@playwright/test';
import { tetraGlb, tetraStl } from '../apps/api/test/helpers/model-fixtures.js';
import {
  coloredThreeMf,
  zipArchive,
} from '../apps/api/test/helpers/three-mf-fixtures.js';

test('local design route, STL/GLB/3MF measurements, replacement and drop without uploading', async ({
  page,
}) => {
  const writes = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' || request.method() === 'PUT')
      writes.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page.getByRole('link', { name: 'Subí tu diseño', exact: true }).click();
  await expect(page).toHaveURL('/disenar');
  const input = page.getByLabel('Archivo de diseño 3D');
  await expect(input).toHaveAttribute('accept', '.3mf,.stl,.glb');
  await expect(
    page.getByRole('heading', { name: 'Subí tu diseño', exact: true }),
  ).toBeVisible();
  for (const [name, buffer, expectedWidth] of [
    ['pieza.STL', tetraStl(), '0,1 cm'],
    ['pieza.glb', tetraGlb(), '100 cm'],
    ['pieza.3mf', coloredThreeMf(), '0,6 cm'],
    ['bambu.3mf', coloredThreeMf({ bambu: true }), '0,6 cm'],
  ]) {
    await input.setInputFiles({
      name,
      mimeType: 'application/octet-stream',
      buffer,
    });
    await expect(
      page.getByRole('button', { name: 'Restablecer vista', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.design-measurements h2')).toHaveText(name);
    await expect(
      page.locator('.design-measurements dl > div').first(),
    ).toHaveText('Ancho' + expectedWidth);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.design-parts-notice')).toHaveCount(
      name.endsWith('.3mf') ? 1 : 0,
    );
  }
  await input.setInputFiles({
    name: 'error.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('bad'),
  });
  await expect(page.getByRole('alert')).toHaveText(
    'El archivo debe ser .3mf, .stl o .glb.',
  );
  await expect(page.locator('canvas')).toHaveCount(0);
  await input.setInputFiles({
    name: 'error.glb',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('bad'),
  });
  await expect(page.locator('.design-page > .error')).toContainText(
    'modelo 3D válido',
  );
  await expect(page.locator('.design-measurements dl')).toHaveCount(0);
  const dataTransfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], 'arrastrado.stl'));
    return data;
  }, Array.from(tetraStl()));
  await page
    .locator('.design-dropzone')
    .dispatchEvent('drop', { dataTransfer });
  await expect(page.locator('.design-measurements h2')).toHaveText(
    'arrastrado.stl',
  );
  await expect(
    page.getByRole('button', { name: 'Restablecer vista', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.design-parts-notice')).toHaveCount(0);
  expect(writes).toEqual([]);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    if (width === 1280) {
      const stage = await page
        .locator('.design-preview .model-stage')
        .boundingBox();
      const measures = await page.locator('.design-measurements').boundingBox();
      expect(Math.abs(stage.y - measures.y)).toBeLessThan(1);
      expect(Math.abs(stage.height - measures.height)).toBeLessThan(1);
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.reload();
  await expect(
    page.getByText(
      'Tu modelo y sus medidas aparecerán acá cuando elijas un archivo.',
    ),
  ).toBeVisible();
});

test('3MF resolves packaged Bambu components, units and repeated mesh transforms', async ({
  page,
}) => {
  const mesh =
    '<mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="2" z="0"/><vertex x="0" y="0" z="3"/></vertices><triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/><triangle v1="1" v2="2" v3="3"/></triangles></mesh>';
  const buffer = zipArchive({
    '3D/3dmodel.model':
      '<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" unit="centimeter"><resources><object id="10"><components><component p:path="/3D/Objects/part.model" objectid="1"/></components></object></resources><build><item objectid="10" transform="1 0 0 0 1 0 0 0 1 10 0 0"/><item objectid="10" transform="1 0 0 0 1 0 0 0 1 20 0 0"/></build></model>',
    '3D/Objects/part.model':
      '<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1">' +
      mesh +
      '</object></resources></model>',
  });
  await page.goto('/disenar');
  await page.getByLabel('Archivo de diseño 3D').setInputFiles({
    name: 'componentes.3mf',
    mimeType: 'application/octet-stream',
    buffer,
  });
  await expect(page.locator('.design-measurements dl')).toContainText(
    'Ancho11 cm',
  );
  await expect(page.locator('.design-measurements dl')).toContainText(
    'Alto3 cm',
  );
  await expect(page.locator('.design-measurements dl')).toContainText(
    'Profundidad2 cm',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('rejects external GLB resources and cyclic 3MF components', async ({
  page,
}) => {
  const external = [];
  page.on('request', (request) => {
    if (request.url().includes('outside.example')) external.push(request.url());
  });
  await page.goto('/disenar');
  await page.getByLabel('Archivo de diseño 3D').setInputFiles({
    name: 'externo.glb',
    mimeType: 'application/octet-stream',
    buffer: tetraGlb((doc) => ({
      ...doc,
      buffers: [{ uri: 'https://outside.example/model.bin', byteLength: 72 }],
    })),
  });
  await expect(page.locator('.design-page > .error')).toContainText(
    'incluir todos sus recursos',
  );
  expect(external).toEqual([]);
  await page.getByLabel('Archivo de diseño 3D').setInputFiles({
    name: 'ciclo.3mf',
    mimeType: 'application/octet-stream',
    buffer: coloredThreeMf({
      transformXml: (xml) =>
        xml.replace('<component objectid="1"/>', '<component objectid="10"/>'),
    }),
  });
  await expect(page.locator('.design-page > .error')).toContainText(
    'referencias circulares',
  );
});

test('STL disconnected shells show the multi-part notice and replacement clears it', async ({
  page,
}) => {
  const first = tetraStl();
  const second = tetraStl();
  for (let t = 0; t < 4; t++)
    for (let corner = 0; corner < 3; corner++) {
      const offset = 84 + t * 50 + 12 + corner * 12;
      second.writeFloatLE(second.readFloatLE(offset) + 10, offset);
    }
  const merged = Buffer.concat([first, second.subarray(84)]);
  merged.writeUInt32LE(8, 80);
  await page.goto('/disenar');
  await page
    .getByLabel('Archivo de diseño 3D')
    .setInputFiles({
      name: 'dos-piezas.stl',
      mimeType: 'application/octet-stream',
      buffer: merged,
    });
  await expect(page.locator('.design-parts-notice')).toContainText(
    'Este archivo contiene varias piezas.',
  );
  await expect(page.locator('.design-parts-notice')).toContainText(
    'subí una versión ensamblada',
  );
  await expect(page.locator('.design-measurements dl')).toContainText(
    'Ancho1,1 cm',
  );
  await page
    .getByLabel('Archivo de diseño 3D')
    .setInputFiles({
      name: 'una-pieza.stl',
      mimeType: 'application/octet-stream',
      buffer: first,
    });
  await expect(
    page.getByRole('button', { name: 'Restablecer vista', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.design-parts-notice')).toHaveCount(0);
});
