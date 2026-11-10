import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { parseLocalMesh } from '../../web/src/local-model-parser.js';
import { packModel, unpackModel } from '../../web/src/model-transfer.js';
import { coloredThreeMf, zipArchive } from './helpers/three-mf-fixtures.js';
import { tetraStl } from './helpers/model-fixtures.js';

function roundTrip(buffer, format = '3mf') {
  const root = parseLocalMesh(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
    format,
  );
  const packed = packModel(root);
  const data = structuredClone(packed.data, { transfer: packed.transfer });
  return unpackModel(data);
}
function size(root) {
  return new THREE.Box3()
    .setFromObject(root)
    .getSize(new THREE.Vector3())
    .toArray()
    .map((n) => Math.round(n * 1e6) / 1e6);
}
test('worker transfer preserves 3MF units, names, colors, transforms and per-piece bounds', () => {
  for (const bambu of [false, true]) {
    const root = roundTrip(coloredThreeMf({ bambu }));
    assert.deepEqual(size(root), [6, 1, 1]);
    assert.equal(root.children.length, 2);
    assert.equal(root.userData.colorStatus, 'complete');
    assert.equal(root.userData.partBounds.length, 2);
    const colors = root.children.map((mesh) =>
      mesh.geometry.getAttribute('color').getX(0),
    );
    assert.ok(colors[0] < 0.02);
    assert.equal(colors[1], 1);
    assert.equal(root.children[0].material.vertexColors, true);
    for (const part of root.userData.partBounds) {
      assert.deepEqual(
        part.max.map((v, i) => Math.round((v - part.min[i]) * 1e6) / 1e6),
        [1, 1, 1],
      );
    }
    if (!bambu)
      assert.deepEqual(
        root.children.map((mesh) => mesh.name),
        ['Parte negra', 'Parte blanca'],
      );
  }
});
test('worker transfer keeps repeated instances distinct while transferring shared geometry only once', () => {
  const root = parseLocalMesh(
    coloredThreeMf({
      transformXml: (xml) =>
        xml.replace(
          '</build>',
          '<item objectid="10" transform="1 0 0 0 1 0 0 0 1 40 30 0"/></build>',
        ),
    }),
    '3mf',
  );
  const packed = packModel(root);
  assert.equal(packed.data.geometries.length, 2);
  assert.equal(packed.data.meshes.length, 4);
  assert.equal(packed.transfer.length, new Set(packed.transfer).size);
  const restored = unpackModel(
    structuredClone(packed.data, { transfer: packed.transfer }),
  );
  assert.deepEqual(size(restored), [26, 1, 1]);
  assert.equal(restored.userData.partBounds.length, 4);
});
test('STL normals and disconnected part bounds survive worker transfer', () => {
  const first = tetraStl(),
    second = tetraStl();
  for (let t = 0; t < 4; t++)
    for (let corner = 0; corner < 3; corner++) {
      const offset = 84 + t * 50 + 12 + corner * 12;
      second.writeFloatLE(second.readFloatLE(offset) + 10, offset);
    }
  const merged = Buffer.concat([first, second.subarray(84)]);
  merged.writeUInt32LE(8, 80);
  const root = roundTrip(merged, 'stl');
  assert.deepEqual(size(root), [11, 1, 1]);
  assert.equal(root.userData.partBounds.length, 2);
  assert.equal(root.children[0].geometry.getAttribute('normal').count, 24);
  assert.equal(root.userData.colorStatus, 'missing');
});
test('worker XML parser rejects malformed XML, DTD, invalid indices and cycles', () => {
  for (const xml of [
    '<model><resources></model>',
    '<!DOCTYPE model [<!ENTITY x "bad">]><model/>',
    '<model><resources/><build/></model><other/>',
  ]) {
    assert.throws(
      () => roundTrip(zipArchive({ '3D/3dmodel.model': xml })),
      /modelo 3D válido/,
    );
  }
  for (const value of ['-1', '0.5', '999', 'NaN']) {
    assert.throws(
      () =>
        roundTrip(
          coloredThreeMf({
            transformXml: (xml) => xml.replace('v1="0"', `v1="${value}"`),
          }),
        ),
      /modelo 3D válido/,
    );
  }
  assert.throws(
    () =>
      roundTrip(
        coloredThreeMf({
          transformXml: (xml) =>
            xml.replace(
              '<component objectid="1"/>',
              '<component objectid="10"/>',
            ),
        }),
      ),
    /referencias circulares/,
  );
});
