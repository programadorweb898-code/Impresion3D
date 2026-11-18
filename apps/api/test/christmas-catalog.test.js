import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { access } from 'node:fs/promises';
import { Product } from '../src/models.js';
import {
  migrateChristmasCatalog,
  christmasImportId,
} from '../src/christmas-catalog.js';
import catalog from '../src/christmas-catalog-20261117.json' with { type: 'json' };
import previous from '../src/makerworld-catalog-20261117.json' with { type: 'json' };
import { productGalleryImages } from '../../web/src/product-gallery-images.js';

let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('diez diseños de Navidad distintos, comerciales, con dos fotos y precios vigentes', async () => {
  assert.equal(catalog.length, 10);
  assert.equal(new Set(catalog.map((p) => p._id)).size, 10);
  assert.equal(new Set(catalog.map((p) => p.name)).size, 10);
  assert.equal(
    new Set([...previous, ...catalog].map((p) => p.source.id)).size,
    40,
  );
  for (const p of catalog) {
    assert.equal(p.category, 'Navidad');
    assert.equal(p.priceCents, p.source.id === '1998883' ? 1500000 : 1000000);
    assert.equal(p.currency, 'ARS');
    assert.equal(p.source.license, 'CC0-1.0');
    assert.equal(p.model, undefined);
    const photos = productGalleryImages(p);
    assert.equal(photos.length, 2);
    for (const photo of photos)
      await access(new URL(`../../web/public${photo.url}`, import.meta.url));
  }
});

test('la nueva carga conserva productos anteriores, precios editados y bajas posteriores', async () => {
  const original = await Product.create({
    name: 'Producto anterior',
    priceCents: 250000,
  });
  await migrateChristmasCatalog();
  assert.equal(await Product.countDocuments(), 11);
  await Product.updateOne(
    { _id: catalog[0]._id },
    { $set: { priceCents: 1234500, active: false } },
  );
  await Product.deleteOne({ _id: catalog[1]._id });
  await migrateChristmasCatalog();
  assert.equal(await Product.countDocuments(), 10);
  assert.equal((await Product.findById(catalog[0]._id)).priceCents, 1234500);
  assert.equal((await Product.findById(catalog[0]._id)).active, false);
  assert.equal(await Product.findById(catalog[1]._id), null);
  assert.equal((await Product.findById(original._id)).priceCents, 250000);
});

test('reanuda una carga incompleta sin duplicar diseños ni sobrescribir precios', async () => {
  await mongoose.connection
    .collection('catalogimports')
    .deleteOne({ _id: christmasImportId });
  await migrateChristmasCatalog();
  assert.equal(await Product.countDocuments(), 11);
  assert.equal((await Product.findById(catalog[0]._id)).priceCents, 1234500);
  assert.equal(
    await Product.countDocuments({ 'source.id': catalog[0].source.id }),
    1,
  );
});
