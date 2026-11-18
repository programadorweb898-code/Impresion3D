import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateMedalDimensionsPrice, medalMeasurementText } from '../src/medal-dimensions-price.js';

function fixture({ conflict = false, missing = false } = {}) {
  const row = { _id: 'b158873faf5b03e11b540971', __v: 0,
    description: 'Soporte de pared. No incluye medallas.', priceCents: 1000000,
    image: { url: '/original.webp' } };
  let applied = false;
  const Product = {
    db: { collection: () => ({ findOne: async () => applied,
      updateOne: async () => { applied = true; } }) },
    findOne: (filter) => {
      assert.equal(filter._id, row._id);
      assert.equal(filter['source.id'], '454689');
      return { lean: async () => missing ? null : structuredClone(row) };
    },
    updateOne: async (filter, update) => {
      assert.equal(filter.__v, row.__v);
      assert.equal(filter.description, row.description);
      if (conflict) return { matchedCount: 0 };
      Object.assign(row, update.$set);
      row.__v += update.$inc.__v;
      return { matchedCount: 1 };
    },
  };
  return { row, Product, applied: () => applied };
}

test('actualiza solo el organizador existente con medidas al 95 % y ARS 3000', async () => {
  const f = fixture();
  await migrateMedalDimensionsPrice(f.Product);
  assert.equal(f.row.priceCents, 300000);
  assert.deepEqual(f.row.dimensions, { width: 237.5, height: 190, depth: 9.5 });
  assert.equal(f.row.description, 'Soporte de pared. No incluye medallas. ' + medalMeasurementText);
  assert.deepEqual(f.row.image, { url: '/original.webp' });
  f.row.priceCents = 700000;
  await migrateMedalDimensionsPrice(f.Product);
  assert.equal(f.row.priceCents, 700000);
  assert.equal(f.row.description.split(medalMeasurementText).length, 2);
});

test('no inserta productos ausentes ni registra una corrección con conflicto', async () => {
  for (const options of [{ missing: true }, { conflict: true }]) {
    const f = fixture(options);
    await migrateMedalDimensionsPrice(f.Product);
    assert.equal(f.applied(), false);
    assert.equal(f.row.priceCents, 1000000);
  }
});
