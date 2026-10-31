import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User, Product, Order } from '../src/models.js';
import { cartItemsSchema, orderSchema } from '@impresion3d/shared';
import {
  loadCart,
  saveCart,
  addCartItem,
  changeCartQuantity,
  cartStorageKeyFor,
} from '../../web/src/cart-state.js';
let mongo, app, products, alice, bob;
const origin = 'http://localhost:5173';
async function csrf(agent) {
  return (await agent.get('/api/csrf')).body.token;
}
async function account(email) {
  const agent = request.agent(app);
  const token = await csrf(agent);
  await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .set('x-csrf-token', token)
    .send({
      name: 'Cliente prueba',
      email,
      password: 'clave-larga-para-carrito',
    })
    .expect(201);
  return agent;
}
async function checkout(agent, body) {
  const token = await csrf(agent);
  return agent
    .post('/api/orders')
    .set('Origin', origin)
    .set('x-csrf-token', token)
    .send(body);
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Order.init()]);
  products = await Product.create([
    {
      name: 'Maceta',
      priceCents: 1200000,
      currency: 'ARS',
      dimensions: { width: 100, height: 110, depth: 100 },
    },
    {
      name: 'Organizador',
      priceCents: 800000,
      currency: 'ARS',
      dimensions: { width: 150, height: 20, depth: 200 },
    },
  ]);
  app = createApp({
    sessionSecret: 'cart-test-secret-with-at-least-32-characters',
    webOrigin: origin,
  });
  alice = await account('cart-alice@example.com');
  bob = await account('cart-bob@example.com');
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
const items = () =>
  products.map((p, i) => ({
    productId: String(p._id),
    quantity: i + 1,
    expectedUnitPriceCents: p.priceCents,
  }));
test('pedido multiproducto calcula el total en servidor y conserva copias históricas privadas', async () => {
  const response = await checkout(alice, {
    items: items(),
    notes: 'Coordinar color',
    totalCents: 1,
    userId: 'f'.repeat(24),
    requestId: randomUUID(),
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.items.length, 2);
  assert.equal(response.body.totalCents, 2800000);
  assert.equal(response.body.requestHash, undefined);
  assert.equal(response.body.requestId, undefined);
  await Product.updateOne(
    { _id: products[0]._id },
    { $set: { name: 'Nombre nuevo' } },
  );
  const history = await alice.get('/api/orders').expect(200);
  assert.equal(history.body[0].items[0].name, 'Maceta');
  assert.equal(history.body[0].items[0].dimensions.height, 110);
  assert.equal((await bob.get('/api/orders')).body.length, 0);
});
test('sin sesión o CSRF no crea pedidos; carrito vacío, duplicados y cantidades fuera de rango son inválidos', async () => {
  const count = await Order.countDocuments();
  await request(app)
    .post('/api/orders')
    .set('Origin', origin)
    .send({ items: items() })
    .expect(403);
  assert.equal(
    (await checkout(request.agent(app), { items: items() })).status,
    401,
  );
  for (const body of [
    { items: [] },
    { items: [items()[0], items()[0]] },
    { items: [{ ...items()[0], quantity: 0 }] },
    { items: [{ ...items()[0], quantity: 21 }] },
  ])
    assert.equal((await checkout(alice, body)).status, 400);
  assert.equal(await Order.countDocuments(), count);
});
test('rechaza el pedido completo si falta un producto o cambia un precio', async () => {
  const count = await Order.countDocuments();
  await Product.updateOne(
    { _id: products[1]._id },
    { $set: { active: false } },
  );
  assert.equal(
    (await checkout(alice, { items: items() })).body.code,
    'PRODUCT_UNAVAILABLE',
  );
  assert.equal(await Order.countDocuments(), count);
  await Product.updateOne(
    { _id: products[1]._id },
    { $set: { active: true, priceCents: 900000 } },
  );
  const changed = await checkout(alice, { items: items() });
  assert.equal(changed.status, 409);
  assert.equal(changed.body.code, 'PRICE_CHANGED');
  assert.equal(await Order.countDocuments(), count);
  await Product.updateOne(
    { _id: products[1]._id },
    { $set: { priceCents: products[1].priceCents } },
  );
});
test('reintentos y solicitudes simultáneas con la misma clave crean un solo pedido por usuario', async () => {
  const requestId = randomUUID(),
    body = { items: items(), notes: 'Pedido único', requestId },
    count = await Order.countDocuments();
  // Obtain CSRF first: concurrent requests must share the same stable session.
  const token = await csrf(alice);
  const post = () =>
    alice
      .post('/api/orders')
      .set('Origin', origin)
      .set('x-csrf-token', token)
      .send(body);
  const [one, two] = await Promise.all([post(), post()]);
  assert.ok([200, 201].includes(one.status));
  assert.ok([200, 201].includes(two.status));
  assert.equal(one.body._id, two.body._id);
  assert.equal(await Order.countDocuments(), count + 1);
  assert.equal((await checkout(alice, body)).body._id, one.body._id);
  assert.equal(
    (await checkout(alice, { ...body, notes: 'Otro pedido' })).body.code,
    'ORDER_KEY_REUSED',
  );
  const other = await checkout(bob, body);
  assert.equal(other.status, 201);
  assert.notEqual(other.body._id, one.body._id);
});
test('persistencia del carrito ignora datos corruptos y nunca guarda precios o credenciales', () => {
  const userId = 'a'.repeat(24),
    key = cartStorageKeyFor(userId);
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    };
  let state = addCartItem([], String(products[0]._id));
  state = addCartItem(state, String(products[0]._id));
  state = changeCartQuantity(state, String(products[0]._id), 3);
  saveCart(state, storage, userId);
  assert.deepEqual(loadCart(storage, userId), state);
  assert.deepEqual(loadCart(storage, 'b'.repeat(24)), []);
  assert.deepEqual(loadCart(storage), []);
  values.set(
    key,
    JSON.stringify({
      version: 1,
      items: [
        {
          productId: String(products[0]._id),
          quantity: 2,
          priceCents: 1,
          password: 'secret',
        },
      ],
    }),
  );
  assert.deepEqual(loadCart(storage, userId), [
    { productId: String(products[0]._id), quantity: 2 },
  ]);
  for (const invalid of [
    'not-json',
    JSON.stringify({ version: 1, items: [{ productId: 'bad', quantity: 1 }] }),
    JSON.stringify({
      version: 1,
      items: [{ productId: String(products[0]._id), quantity: 99 }],
    }),
  ]) {
    values.set(key, invalid);
    assert.deepEqual(loadCart(storage, userId), []);
  }
  assert.throws(() => changeCartQuantity(state, String(products[0]._id), 21));
  assert.equal(cartItemsSchema.safeParse([...state, ...state]).success, false);
  assert.equal(orderSchema.safeParse({ items: [] }).success, false);
});
