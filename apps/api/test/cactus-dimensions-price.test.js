import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCactusDimensionsPrice, cactusMeasurementText } from '../src/cactus-dimensions-price.js';

function fixture({ conflict = false, missing = false } = {}) {
  const row = { _id: 'ba3d15e5646ef11acd95e93f', __v: 0,
    description: 'Maceta vacía. No incluye planta.', priceCents: 1000000,
    image: { url: '/original.webp' } };
  let applied = false;
  const Product = {
    db: { collection: () => ({ findOne: async () => applied,
      updateOne: async () => { applied = true; } }) },
    findOne: (filter) => {
      assert.equal(filter._id, row._id);
      assert.equal(filter['source.id'], '1423054');
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

test('actualiza solo la maceta existente con medidas del cuerpo y ARS 5000', async () => {
  const f = fixture();
  await migrateCactusDimensionsPrice(f.Product);
  assert.equal(f.row.priceCents, 500000);
  assert.deepEqual(f.row.dimensions, { width: 66.35, height: 55, depth: 66.35 });
  assert.equal(f.row.description, 'Maceta vacía. No incluye planta. ' + cactusMeasurementText);
  assert.deepEqual(f.row.image, { url: '/original.webp' });
  f.row.priceCents = 700000;
  await migrateCactusDimensionsPrice(f.Product);
  assert.equal(f.row.priceCents, 700000);
  assert.equal(f.row.description.split(cactusMeasurementText).length, 2);
});

test('no inserta productos ausentes ni registra una corrección con conflicto', async () => {
  for (const options of [{ missing: true }, { conflict: true }]) {
    const f = fixture(options);
    await migrateCactusDimensionsPrice(f.Product);
    assert.equal(f.applied(), false);
    assert.equal(f.row.priceCents, 1000000);
  }
});
