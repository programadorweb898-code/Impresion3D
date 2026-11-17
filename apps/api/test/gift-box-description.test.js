import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateGiftBoxDescription } from '../src/gift-box-description.js';
function fixture({ conflict = false } = {}) {
  const row = { _id: '457689d2e2a26c02a14d63c2', source: { id: '74951' }, __v: 2,
    description: 'Caja. La caja mide aproximadamente 11,6 cm de largo × 8,5 cm de ancho × 1,9 cm de profundidad, sin contar la tapa ni la perilla. Se entrega armada.',
    priceCents: 1000000, image: { url: '/foto.webp' } };
  let applied = false;
  const Product = {
    db: { collection: () => ({
      findOne: async () => applied ? { _id: 'done' } : null,
      updateOne: async () => { applied = true; },
    }) },
    findOne: (filter) => {
      assert.equal(filter._id, row._id);
      assert.equal(filter['source.id'], '74951');
      return { lean: async () => structuredClone(row) };
    },
    updateOne: async (filter, update) => {
      if (conflict) return { matchedCount: 0 };
      assert.equal(filter.__v, row.__v);
      assert.equal(filter.description, row.description);
      Object.assign(row, update.$set);
      row.__v += update.$inc.__v;
      return { matchedCount: 1 };
    },
  };
  return { row, Product, applied: () => applied };
}
test('carga medidas en mm y precio de 5000 ARS, retira la frase y conserva foto', async () => {
  const f = fixture();
  await migrateGiftBoxDescription(f.Product);
  assert.deepEqual(f.row.dimensions, { width: 116, height: 85, depth: 19 });
  assert.equal(f.row.priceCents, 500000);
  assert.equal(f.row.description, 'Caja. Se entrega armada.');
  assert.deepEqual(f.row.image, { url: '/foto.webp' });
  assert.equal(f.applied(), true);
});
test('reinicios no reemplazan posteriores ediciones administrativas', async () => {
  const f = fixture();
  await migrateGiftBoxDescription(f.Product);
  f.row.priceCents = 600000;
  f.row.dimensions.depth = 20;
  f.row.description = 'Texto editado.';
  await migrateGiftBoxDescription(f.Product);
  assert.equal(f.row.priceCents, 600000);
  assert.equal(f.row.dimensions.depth, 20);
  assert.equal(f.row.description, 'Texto editado.');
});
test('una edición concurrente no marca la corrección como aplicada', async () => {
  const f = fixture({ conflict: true });
  await migrateGiftBoxDescription(f.Product);
  assert.equal(f.applied(), false);
  assert.equal(f.row.priceCents, 1000000);
});
