import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { performance } from 'node:perf_hooks';
import { createApp } from '../src/app.js';
import { Product, Order } from '../src/models.js';
import { relevancePipeline } from '../src/relevance.js';
let mongo, app, products;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Product.init(), Order.init()]);
  products = await Product.insertMany(
    Array.from({ length: 200 }, (_, i) => ({
      name: `Producto ${i}`,
      category: 'Hogar',
      active: true,
      priceCents: i * 100,
      image: { url: '/foto.webp', publicId: 'identificador-interno' },
    })),
  );
  const userId = new mongoose.Types.ObjectId();
  for (const [status, quantity] of [
    ['en_espera', 10],
    ['en_preparacion', 2],
    ['finalizado', 3],
    ['cancelado', 50],
  ]) {
    await Order.create({
      userId,
      status,
      totalCents: 100,
      currency: 'ARS',
      items: [{ productId: products[0]._id, quantity, unitPriceCents: 100 }],
      history: [{ status: 'aprobado', at: new Date() }].filter(
        () => status === 'cancelado',
      ),
    });
  }
  app = createApp({
    sessionSecret: 'catalog-capacity-test-secret-32-characters',
    webOrigin: 'http://localhost',
  });
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
test('relevancia cuenta ventas actuales sin pendientes ni canceladas y no publica campos internos', async () => {
  const r = await request(app).get('/api/products?page=1').expect(200);
  assert.equal(r.body.products[0]._id, String(products[0]._id));
  assert.equal(r.body.products[0].salesCount, 5);
  assert.equal(r.body.products[0].image.publicId, undefined);
  assert.equal(r.body.products[0].__v, undefined);
  const byId = await request(app)
    .get('/api/products/' + products[0]._id)
    .expect(200);
  assert.equal(byId.body.image.publicId, undefined);
  const byIds = await request(app)
    .get('/api/products?ids=' + products[0]._id)
    .expect(200);
  assert.equal(byIds.body[0].image.publicId, undefined);
});
test('precio usa índice y diez clientes concurrentes reciben respuestas completas', async () => {
  const plan = await Product.collection
    .find({ active: true })
    .sort({ priceCents: 1, _id: 1 })
    .limit(20)
    .explain('executionStats');
  assert.equal(plan.executionStats.totalDocsExamined, 20);
  assert.ok(
    !JSON.stringify(plan.queryPlanner.winningPlan).includes('COLLSCAN'),
  );
  const relevance = await Product.aggregate(
    relevancePipeline({ active: true }, 1, 20),
  ).explain('executionStats');
  const lookup = relevance.stages.find((stage) => stage.$lookup);
  assert.ok(lookup.indexesUsed.includes('items.productId_1'));
  const timings = [];
  for (let batch = 0; batch < 5; batch++) {
    await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const start = performance.now();
        const r = await request(app)
          .get('/api/products?page=1' + (i % 2 ? '&sort=price-asc' : ''))
          .expect(200);
        assert.equal(r.body.products.length, 10);
        assert.equal(r.body.total, 200);
        assert.equal(r.body.pages, 20);
        timings.push(performance.now() - start);
      }),
    );
  }
  timings.sort((a, b) => a - b);
  console.info(
    JSON.stringify({
      test: 'catalog-concurrency',
      requests: 50,
      concurrent: 10,
      fixtureProducts: 200,
      p95Ms: Math.round(timings[Math.ceil(timings.length * 0.95) - 1]),
    }),
  );
});
