import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { access } from 'node:fs/promises';
import { Product } from '../src/models.js';
import {
  migrateMakerworldCatalog,
  makerworldImportId,
} from '../src/makerworld-catalog.js';
import catalog from '../src/makerworld-catalog-20261117.json' with { type: 'json' };
import { productGalleryImages } from '../../web/src/product-gallery-images.js';
import { productUpdateSchema } from '@impresion3d/shared';

let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('30 diseños distintos con uso comercial, dos imágenes y precios corregidos', async () => {
  assert.equal(catalog.length, 30);
  for (const field of ['_id', 'name'])
    assert.equal(new Set(catalog.map((p) => p[field])).size, 30);
  assert.equal(new Set(catalog.map((p) => p.source.id)).size, 30);
  for (const p of catalog) {
    const correctedPrices = {
      '74951': 500000,
      '50252': 3500000,
      '13122': 800000,
      '1423054': 500000,
      '1486060': 200000,
    };
    assert.equal(p.priceCents, correctedPrices[p.source.id] ?? 1000000);
    assert.equal(p.currency, 'ARS');
    assert.equal(p.source.license, 'CC0-1.0');
    assert.equal(p.model, undefined);
    const photos = productGalleryImages(p);
    assert.equal(photos.length, 2);
    for (const photo of photos)
      await access(new URL(`../../web/public${photo.url}`, import.meta.url));
  }
});

test('importación repetible conserva originales, precios editados y productos eliminados', async () => {
  const original = await Product.create({
    name: 'Producto anterior',
    priceCents: 250000,
  });
  await migrateMakerworldCatalog();
  assert.equal(await Product.countDocuments(), 31);
  await Product.updateOne(
    { _id: catalog[0]._id },
    { $set: { priceCents: 1299900, active: false } },
  );
  await Product.deleteOne({ _id: catalog[1]._id });
  await migrateMakerworldCatalog();
  assert.equal(await Product.countDocuments(), 30);
  assert.equal((await Product.findById(catalog[0]._id)).priceCents, 1299900);
  assert.equal((await Product.findById(catalog[0]._id)).active, false);
  assert.equal(await Product.findById(catalog[1]._id), null);
  assert.equal((await Product.findById(original._id)).priceCents, 250000);
});

test('recupera una importación parcial y no duplica diseños ya existentes', async () => {
  await mongoose.connection
    .collection('catalogimports')
    .deleteOne({ _id: makerworldImportId });
  await migrateMakerworldCatalog();
  assert.equal(await Product.countDocuments(), 31);
  assert.equal((await Product.findById(catalog[0]._id)).priceCents, 1299900);
  assert.equal(
    await Product.countDocuments({ 'source.id': catalog[0].source.id }),
    1,
  );
});

test('permite corregir el precio sin inventar medidas pendientes', () => {
  const { _id, image, gallery, source, imageNotice, ...fields } = catalog[0];
  assert.equal(
    productUpdateSchema.safeParse({
      ...fields,
      priceCents: 1500000,
      version: 0,
    }).success,
    true,
  );
});
