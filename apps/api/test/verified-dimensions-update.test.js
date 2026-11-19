import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../src/verified-dimensions-20261119.json' with { type: 'json' };
import { migrateVerifiedDimensions } from '../src/verified-dimensions-update.js';

function fixture({ conflict = false } = {}) {
  const rows = new Map(
    records.map((r) => [
      r.id,
      {
        _id: r.id,
        __v: 0,
        source: { id: r.sourceId },
        description: 'Texto conservado.',
        priceCents: 1234500,
        image: { url: '/foto-original.webp' },
      },
    ]),
  );
  const completed = new Set();
  const updates = [];
  const Product = {
    db: {
      collection: () => ({
        findOne: async (filter) => completed.has(filter._id),
        updateOne: async (filter) => completed.add(filter._id),
      }),
    },
    findOne: (filter) => ({
      lean: async () => {
        const row = rows.get(filter._id);
        return row?.source.id === filter['source.id']
          ? structuredClone(row)
          : null;
      },
    }),
    updateOne: async (filter, update) => {
      const row = rows.get(filter._id);
      if (conflict || row.__v !== filter.__v) return { matchedCount: 0 };
      for (const [key, value] of Object.entries(update.$set)) {
        assert.match(key, /^dimensions\.(width|height|depth)$/);
        row.dimensions ??= {};
        assert.equal(Number.isFinite(row.dimensions[key.split('.')[1]]), false);
        row.dimensions[key.split('.')[1]] = value;
      }
      row.__v += update.$inc.__v;
      updates.push(filter._id);
      return { matchedCount: 1 };
    },
  };
  return { Product, rows, completed, updates };
}

test('agrega solo medidas verificadas vacías y conserva todos los demás campos', async () => {
  const f = fixture();
  const first = f.rows.get(records[0].id);
  first.dimensions = { width: records[0].dimensions.width };
  await migrateVerifiedDimensions(f.Product);
  for (const r of records) {
    const row = f.rows.get(r.id);
    assert.deepEqual(row.dimensions, r.dimensions);
    assert.equal(row.description, 'Texto conservado.');
    assert.equal(row.priceCents, 1234500);
    assert.deepEqual(row.image, { url: '/foto-original.webp' });
  }
  assert.equal(f.updates.length, 4);
  first.dimensions.width = 999;
  await migrateVerifiedDimensions(f.Product);
  assert.equal(first.dimensions.width, 999);
  assert.equal(f.updates.length, 4);
});

test('no reemplaza medidas existentes ni completa una ficha con datos contradictorios', async () => {
  const f = fixture();
  for (const r of records)
    f.rows.get(r.id).dimensions = structuredClone(r.dimensions);
  f.rows.get(records[0].id).dimensions.width = 999;
  await migrateVerifiedDimensions(f.Product);
  assert.equal(f.updates.length, 0);
  assert.equal(f.rows.get(records[0].id).dimensions.width, 999);
});

test('una edición concurrente no se sobrescribe ni se marca como completada', async () => {
  const f = fixture({ conflict: true });
  await migrateVerifiedDimensions(f.Product);
  assert.equal(f.completed.size, 0);
  assert.equal(f.updates.length, 0);
});
