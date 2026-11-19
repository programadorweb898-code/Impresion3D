import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Product } from '../src/models.js';
import { migrateShowerShelf } from '../src/shower-shelf-update.js';
import { migrateInterchangeableTree } from '../src/interchangeable-tree-update.js';
import { migratePawDimensionsPrice } from '../src/paw-dimensions-price.js';
import { migrateCompactPhone } from '../src/compact-phone-update.js';
import { migrateVerifiedDimensions } from '../src/verified-dimensions-update.js';
import records from '../src/verified-dimensions-20261119.json' with { type: 'json' };

test('el lote actualiza ocho fichas, conserva el resto y respeta ediciones posteriores', async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri());
    const pending = [
      ['afe967a033dc7cd1d7fd2099', '106945', 500000],
      ['aa541933f3162551c2b3378e', '55275', 500000],
      ['9fa5cd6ffc6c88fcbd9f2468', '806001', 300000],
      ['96662806919bd26a60e00b30', '692815', 800000],
    ];
    await Product.insertMany([
      ...pending.map(([id, sourceId]) => ({
        _id: id,
        source: { id: sourceId },
        name: id,
        description: 'Descripción original.',
        priceCents: 1000000,
        image: { url: '/original.webp' },
      })),
      ...records.map((r) => ({
        _id: r.id,
        source: { id: r.sourceId },
        name: r.name,
        description: 'Descripción conservada.',
        priceCents: 1234500,
        image: { url: '/original.webp' },
      })),
    ]);
    const untouched = await Product.create({
      name: 'Producto ya completo',
      priceCents: 99900,
      description: 'Sin cambios.',
      dimensions: { width: 51, height: 62, depth: 73 },
    });
    const migrations = [
      migrateShowerShelf,
      migrateInterchangeableTree,
      migratePawDimensionsPrice,
      migrateCompactPhone,
      migrateVerifiedDimensions,
    ];
    for (const migrate of migrations) await migrate(Product);
    assert.equal(await Product.countDocuments(), 9);
    for (const [id, , price] of pending) {
      const row = await Product.findById(id).lean();
      assert.equal(row.priceCents, price);
      assert.ok(row.dimensions.height > 0);
      assert.equal(
        row.image.url,
        id === pending[0][0]
          ? '/product-catalog/shower-stone-20261118-front.webp'
          : '/original.webp',
      );
    }
    for (const r of records) {
      const row = await Product.findById(r.id).lean();
      assert.deepEqual(row.dimensions, r.dimensions);
      assert.equal(row.priceCents, 1234500);
      assert.equal(row.description, 'Descripción conservada.');
      assert.equal(row.image.url, '/original.webp');
    }
    const retained = await Product.findById(untouched._id).lean();
    assert.deepEqual(retained.dimensions, { width: 51, height: 62, depth: 73 });
    assert.equal(retained.priceCents, 99900);
    await Product.updateOne(
      { _id: pending[0][0] },
      { $set: { priceCents: 777000 } },
    );
    for (const migrate of migrations) await migrate(Product);
    assert.equal((await Product.findById(pending[0][0])).priceCents, 777000);
    assert.equal(await Product.countDocuments(), 9);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
