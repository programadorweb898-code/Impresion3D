import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/makerworld-catalog-20261117.json' with { type: 'json' };
import { migrateGiftBoxDescription } from '../src/gift-box-description.js';
const box = catalog.find((p) => p._id === '457689d2e2a26c02a14d63c2');
const oldDescription = 'Caja impresa en 3D con tapa y cierre mecánico accionado por una perilla. Su formato rectangular permite presentar una tarjeta de regalo o guardar pequeños recuerdos. Se entrega armada; el contenido de ambientación no está incluido.';
function model(rows) {
  return {
    async updateOne(filter, update) {
      const row = rows.find((p) => p._id === filter._id && p.source.id === filter['source.id'] && p.description === filter.description);
      if (!row) return { modifiedCount: 0 };
      Object.assign(row, update.$set);
      row.__v += update.$inc.__v;
      return { modifiedCount: 1 };
    },
  };
}
test('actualiza la caja existente, preserva precio y foto y no modifica otra pieza', async () => {
  const row = { ...structuredClone(box), description: oldDescription, __v: 3, priceCents: 123456 };
  const other = { ...structuredClone(row), _id: '000000000000000000000001' };
  const beforeOther = structuredClone(other), beforeImage = structuredClone(row.image);
  const Product = model([row, other]);
  assert.equal((await migrateGiftBoxDescription(Product)).modifiedCount, 1);
  assert.match(row.description, /11,6 cm de largo × 8,5 cm de ancho × 1,9 cm de profundidad/);
  assert.match(row.description, /sin contar la tapa ni la perilla/);
  assert.equal(row.priceCents, 123456);
  assert.deepEqual(row.image, beforeImage);
  assert.deepEqual(other, beforeOther);
  assert.equal(row.__v, 4);
  assert.equal((await migrateGiftBoxDescription(Product)).modifiedCount, 0);
  assert.equal(row.__v, 4);
});
test('conserva una descripción editada por el administrador', async () => {
  const row = { ...structuredClone(box), description: 'Descripción personalizada.', __v: 8 };
  assert.equal((await migrateGiftBoxDescription(model([row]))).modifiedCount, 0);
  assert.equal(row.description, 'Descripción personalizada.');
  assert.equal(row.__v, 8);
});
