import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threeMfToGlb } from '../src/three-mf.js';
import { validateProductModel } from '../src/product-models.js';
import {
  coloredThreeMf,
  glbJson,
  zipArchive,
} from './helpers/three-mf-fixtures.js';
test('3MF estándar conserva colores, piezas, transformaciones y unidades al convertirse a GLB válido', async () => {
  const result = await validateProductModel({
    buffer: coloredThreeMf(),
    originalname: 'test.3mf',
  });
  assert.equal(result.format, 'glb');
  assert.equal(result.sourceFormat, '3mf');
  assert.equal(result.colorCount, 2);
  assert.equal(result.triangles, 8);
  const doc = glbJson(result.buffer);
  assert.deepEqual(doc.nodes[0].scale, [0.001, 0.001, 0.001]);
  assert.equal(doc.meshes.length, 2);
  const black = doc.materials[0].pbrMetallicRoughness.baseColorFactor;
  assert.ok(black[0] > 0 && black[0] < 0.01);
  assert.deepEqual(
    doc.materials[1].pbrMetallicRoughness.baseColorFactor,
    [1, 1, 1, 1],
  );
  assert.deepEqual(doc.nodes[1].matrix.slice(12, 15), [20, 30, 0]);
  assert.ok(doc.nodes.some((n) => n.name === 'Parte blanca'));
  assert.ok(doc.nodes.some((n) => n.matrix?.[12] === 5));
});
test('3MF de proyecto Bambu usa la paleta de filamentos y asignaciones por parte', async () => {
  const result = await validateProductModel({
    buffer: coloredThreeMf({ bambu: true }),
    originalname: 'bambu.3mf',
  });
  const doc = glbJson(result.buffer);
  assert.equal(result.colorCount, 2);
  assert.ok(doc.materials[0].pbrMetallicRoughness.baseColorFactor[0] < 0.01);
  assert.equal(doc.materials[1].pbrMetallicRoughness.baseColorFactor[0], 1);
});
test('rechaza ZIP inválido, referencias externas, ciclos y pintado no compatible', async () => {
  await assert.rejects(
    () => threeMfToGlb(Buffer.from('not a zip')),
    /ZIP válido/,
  );
  await assert.rejects(
    () =>
      threeMfToGlb(
        coloredThreeMf({
          transformXml: (s) =>
            s.replace(
              '<component objectid="1"/>',
              '<component objectid="1" path="https://other.example/a.model"/>',
            ),
        }),
      ),
    /referencias externas/,
  );
  await assert.rejects(
    () =>
      threeMfToGlb(
        coloredThreeMf({
          transformXml: (s) =>
            s.replace(
              '<component objectid="1"/>',
              '<component objectid="10"/>',
            ),
        }),
      ),
    /circulares/,
  );
  await assert.rejects(
    () =>
      threeMfToGlb(
        coloredThreeMf({
          transformXml: (s) =>
            s.replace('<triangle v1="0"', '<triangle paint_color="FF" v1="0"'),
        }),
      ),
    /pintado avanzado/,
  );
  await assert.rejects(
    () =>
      threeMfToGlb(
        coloredThreeMf({
          transformXml: (s) =>
            '<!DOCTYPE model [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + s,
        }),
      ),
    /XML inválido/,
  );
  const oversized = zipArchive({ '3D/3dmodel.model': 'tiny' });
  const central = oversized.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  oversized.writeUInt32LE(17 * 1024 * 1024, central + 24);
  await assert.rejects(() => threeMfToGlb(oversized), /descompresión/);
});
