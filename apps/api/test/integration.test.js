import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User, Product, Order } from '../src/models.js';
let mongo, store, app;
const origin = 'http://localhost:5173';
const password = 'una-clave-larga-de-prueba';
const productData = {
  name: 'Maceta de prueba',
  description: 'Producto para integración',
  category: 'Hogar',
  color: 'sand',
  priceCents: 1200000,
  currency: 'ARS',
  dimensions: { width: 120, height: 110, depth: 120 },
  active: true,
};
async function mutate(agent, method, path, data) {
  const { body } = await agent.get('/api/csrf').expect(200);
  return agent[method](path)
    .set('Origin', origin)
    .set('x-csrf-token', body.token)
    .send(data);
}
async function register(agent, email, extra = {}) {
  return mutate(agent, 'post', '/api/auth/register', {
    name: 'Persona de prueba',
    email,
    password,
    ...extra,
  });
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'impresion3d_test' });
  await Promise.all([User.init(), Product.init(), Order.init()]);
  store = MongoStore.create({
    client: mongoose.connection.getClient(),
    dbName: mongoose.connection.name,
    collectionName: 'sessions',
    autoRemove: 'disabled',
  });
  app = createApp({
    sessionStore: store,
    sessionSecret: 'integration-test-secret-at-least-32-characters',
    webOrigin: origin,
  });
});
after(async () => {
  await store?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});
test('registro, Argon2id, persistencia de sesión, login y cierre reales', async () => {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/csrf');
  const oldCookie = csrf.headers['set-cookie'][0].split(';')[0];
  const created = await register(agent, 'sesion@example.com');
  assert.equal(created.status, 201);
  assert.equal(created.body.role, 'customer');
  assert.equal(created.body.passwordHash, undefined);
  const user = await User.findOne({ email: 'sesion@example.com' }).select(
    '+passwordHash',
  );
  assert.match(user.passwordHash, /^\$argon2id\$/);
  assert.notEqual(user.passwordHash, password);
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.id, String(user._id));
  assert.ok(
    (await mongoose.connection.collection('sessions').countDocuments()) > 0,
  );
  await request(app).get('/api/auth/me').set('Cookie', oldCookie).expect(401);
  const sessionCookie = created.headers['set-cookie'][0].split(';')[0];
  await request(app)
    .get('/api/auth/me')
    .set('Cookie', sessionCookie)
    .expect(200);
  const logout = await mutate(agent, 'post', '/api/auth/logout', {});
  assert.equal(logout.status, 204);
  await request(app)
    .get('/api/auth/me')
    .set('Cookie', sessionCookie)
    .expect(401);
  const bad = await mutate(agent, 'post', '/api/auth/login', {
    email: 'sesion@example.com',
    password: 'incorrecta',
  });
  assert.equal(bad.status, 401);
  const login = await mutate(agent, 'post', '/api/auth/login', {
    email: ' SESION@EXAMPLE.COM ',
    password,
  });
  assert.equal(login.status, 200);
  const duplicate = await register(request.agent(app), 'sesion@example.com');
  assert.equal(duplicate.status, 409);
});
test('precios del servidor, copia histórica y aislamiento entre clientes', async () => {
  const alice = request.agent(app),
    bob = request.agent(app);
  assert.equal((await register(alice, 'alice@example.com')).status, 201);
  assert.equal((await register(bob, 'bob@example.com')).status, 201);
  const product = await Product.create(productData);
  const response = await mutate(alice, 'post', '/api/orders', {
    productId: String(product._id),
    quantity: 2,
    notes: 'Azul',
    totalCents: 1,
    userId: 'f'.repeat(24),
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.totalCents, 2400000);
  await Product.updateOne(
    { _id: product._id },
    { $set: { name: 'Otro nombre', priceCents: 1 } },
  );
  const history = await alice.get('/api/orders').expect(200);
  assert.equal(history.body.length, 1);
  assert.equal(history.body[0].items[0].name, productData.name);
  assert.equal(history.body[0].items[0].unitPriceCents, 1200000);
  const other = await bob.get('/api/orders').expect(200);
  assert.equal(other.body.length, 0);
  await Product.updateOne({ _id: product._id }, { $set: { active: false } });
  assert.equal(
    (
      await mutate(alice, 'post', '/api/orders', {
        productId: String(product._id),
        quantity: 1,
      })
    ).status,
    404,
  );
});
test('administración: permisos, productos, estados y concurrencia', async () => {
  const admin = request.agent(app),
    customer = request.agent(app);
  await register(admin, 'admin@example.com');
  await register(customer, 'customer@example.com', { role: 'admin' });
  const ordinary = await User.findOne({ email: 'customer@example.com' });
  assert.equal(ordinary.role, 'customer');
  await customer.get('/api/admin/products').expect(403);
  await request(app).get('/api/admin/orders').expect(401);
  await User.updateOne(
    { email: 'admin@example.com' },
    { $set: { role: 'admin' } },
  );
  const created = await mutate(
    admin,
    'post',
    '/api/admin/products',
    productData,
  );
  assert.equal(created.status, 201);
  const id = created.body._id;
  const orderResponse = await mutate(customer, 'post', '/api/orders', {
    productId: id,
    quantity: 1,
  });
  assert.equal(orderResponse.status, 201);
  const orderId = orderResponse.body._id;
  const patch = (data) =>
    mutate(admin, 'patch', '/api/admin/orders/' + orderId, data);
  const eta = new Date(Date.now() + 86400000).toISOString();
  assert.equal(
    (await patch({ status: 'entregado', estimatedReadyAt: eta, version: 0 }))
      .status,
    400,
  );
  assert.equal(
    (
      await patch({
        status: 'en_revision',
        estimatedReadyAt: '2020-01-01T00:00:00.000Z',
        version: 0,
      })
    ).status,
    400,
  );
  const updated = await patch({
    status: 'en_revision',
    estimatedReadyAt: eta,
    version: 0,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.__v, 1);
  assert.equal(updated.body.history.length, 2);
  assert.equal(
    (await patch({ status: 'cancelado', estimatedReadyAt: null, version: 0 }))
      .status,
    409,
  );
  const history = await customer.get('/api/orders');
  assert.equal(history.body[0].estimatedReadyAt, eta);
  const listed = await admin.get('/api/admin/orders').expect(200);
  assert.ok(
    listed.body.orders.some((o) => o.userId.email === 'customer@example.com'),
  );
  const hidden = await mutate(admin, 'put', '/api/admin/products/' + id, {
    ...productData,
    active: false,
  });
  assert.equal(hidden.status, 200);
  const catalog = await customer.get('/api/products');
  assert.equal(
    catalog.body.some((p) => p._id === id),
    false,
  );
  await User.updateOne(
    { email: 'admin@example.com' },
    { $set: { role: 'customer' } },
  );
  await admin.get('/api/admin/products').expect(403);
});
