import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Product, User, Order } from '../src/models.js';
import { offerDefinitions, cartItemsSchema } from '@impresion3d/shared';
import { prepareCheckout } from '../../web/src/checkout-state.js';
let mongo, app, client, options, keys;
const origin = 'http://localhost:5173';
const line = (
  id,
  selections,
  mode = id === 'llaveros' ? 'custom' : 'pack',
) => ({
  productId: offerDefinitions[id].productId,
  quantity: 1,
  offer: { id, mode, selections },
});
async function post(path, body) {
  const token = (await client.get('/api/csrf')).body.token;
  return client
    .post(path)
    .set('Origin', origin)
    .set('x-csrf-token', token)
    .send(body);
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Order.init()]);
  app = createApp({
    sessionSecret: 'offers-tests-long-session-secret-at-least32',
    webOrigin: origin,
  });
  client = request.agent(app);
  await post('/api/auth/register', {
    name: 'Ofertas',
    email: 'offers@example.com',
    password: 'OfertasPrueba1!',
  });
  await Product.create([
    { _id: '6aebbe01d3ce05ca9019abcc', name: 'Bandeja', priceCents: 600000 },
    {
      _id: '6aebd7f3acda2c45fbf8110e',
      name: 'Bola tejida',
      priceCents: 300000,
    },
  ]);
  options = await Product.create(
    Array.from({ length: 5 }, (_, i) => ({
      name: 'Adorno ' + i,
      description: 'Figura tejida ' + i,
      priceCents: 600000,
    })),
  );
  keys = await Product.create([
    { name: 'Llavero Malvinas', priceCents: 300000 },
    { name: 'Llavero River', priceCents: 300000 },
  ]);
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
const chosen = () =>
  options.slice(0, 4).map((p) => ({ id: String(p._id), quantity: 1 }));
test('oferta exige cuatro opciones reales, precio servidor, instantánea e idempotencia con selección', async () => {
  await client.get('/api/offers/__proto__').expect(404);
  const details = await client.get('/api/offers/navidad-combo').expect(200);
  assert.equal(details.body.options.length, 5);
  const valid = line('navidad-combo', chosen());
  assert.equal(cartItemsSchema.safeParse([valid]).success, true);
  for (const count of [3, 5])
    await post('/api/orders', {
      items: [
        line(
          'navidad-combo',
          options
            .slice(0, count)
            .map((p) => ({ id: String(p._id), quantity: 1 })),
        ),
      ],
      requestId: randomUUID(),
    }).then((r) => assert.equal(r.status, 400));
  await post('/api/orders', { items: [{ ...valid, quantity: 2 }] }).then((r) =>
    assert.equal(r.status, 400),
  );
  await post('/api/orders', {
    items: [{ productId: valid.productId, quantity: 1 }],
  }).then((r) => assert.equal(r.status, 400));
  await post('/api/orders', {
    items: [{ ...valid, expectedUnitPriceCents: 1 }],
  }).then((r) => assert.equal(r.status, 409));
  const bad = structuredClone(valid);
  bad.offer.selections[0].id = String(keys[0]._id);
  await post('/api/orders', { items: [bad] }).then((r) =>
    assert.equal(r.status, 404),
  );
  const requestId = randomUUID();
  const saved = await post('/api/orders', { items: [valid], requestId });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal(saved.body.totalCents, 3500000);
  assert.equal(saved.body.items[0].offer.selections.length, 4);
  assert.match(saved.body.items[0].name, /Figura tejida/);
  const reordered = structuredClone(valid);
  reordered.offer.selections.reverse();
  const replay = await post('/api/orders', { items: [reordered], requestId });
  assert.equal(replay.status, 200);
  assert.equal(replay.body._id, saved.body._id);
  const changed = structuredClone(valid);
  changed.offer.selections[0].id = String(options[4]._id);
  await post('/api/orders', { items: [changed], requestId }).then((r) =>
    assert.equal(r.status, 409),
  );
  await Product.updateOne({ _id: options[0]._id }, { $set: { active: false } });
  await post('/api/orders', { items: [valid], requestId: randomUUID() }).then(
    (r) => assert.equal(r.status, 404),
  );
  assert.equal(
    (await post('/api/orders', { items: [valid], requestId })).body._id,
    saved.body._id,
  );
  await Product.updateOne({ _id: options[0]._id }, { $set: { active: true } });
});
test('bolas validan colores, cantidades y precio de $2.500 desde seis', async () => {
  const pack = line('navidad-bolas', [
    { id: 'rojo', quantity: 3 },
    { id: 'dorado', quantity: 3 },
  ]);
  const preview = await post('/api/offers/cart/preview', { items: [pack] });
  assert.equal(preview.status, 200);
  assert.equal(preview.body[0].priceCents, 1500000);
  const saved = await post('/api/orders', { items: [pack] });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.totalCents, 1500000);
  assert.match(saved.body.items[0].name, /Dorado metalizado/);
  const single = line(
    'navidad-bolas',
    [{ id: 'verde', quantity: 1 }],
    'single',
  );
  assert.equal(
    (await post('/api/orders', { items: [single] })).body.totalCents,
    300000,
  );
  const bad = line('navidad-bolas', [{ id: 'verde', quantity: 5 }]);
  await post('/api/orders', { items: [bad] }).then((r) =>
    assert.equal(r.status, 400),
  );
  for (const [quantity, total] of [
    [6, 1500000],
    [7, 1750000],
    [10, 2500000],
    [20, 5000000],
  ]) {
    const response = await post('/api/orders', {
      items: [line('navidad-bolas', [{ id: 'verde', quantity }])],
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.totalCents, total);
  }
  const five = await post('/api/orders', {
    items: [line('navidad-bolas', [{ id: 'rojo', quantity: 5 }], 'single')],
  });
  assert.equal(five.body.totalCents, 1500000);
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k),
    setItem: (k, v) => values.set(k, v),
  };
  const first = prepareCheckout('a'.repeat(24), { items: [pack] }, storage);
  const next = prepareCheckout('a'.repeat(24), { items: [single] }, storage);
  assert.notEqual(first.requestId, next.requestId);
});
test('llaveros calculan el descuento desde cinco y rechazan cantidades o diseños falsos', async () => {
  for (const [quantity, total] of [
    [1, 300000],
    [4, 1200000],
    [5, 1000000],
    [8, 1600000],
  ]) {
    const saved = await post('/api/orders', {
      items: [line('llaveros', [{ id: String(keys[0]._id), quantity }])],
    });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    assert.equal(saved.body.totalCents, total);
  }
  await post('/api/orders', {
    items: [line('llaveros', [{ id: String(keys[0]._id), quantity: 21 }])],
  }).then((r) => assert.equal(r.status, 400));
  await post('/api/orders', {
    items: [line('llaveros', [{ id: String(options[0]._id), quantity: 5 }])],
  }).then((r) => assert.equal(r.status, 404));
});
