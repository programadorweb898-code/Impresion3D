import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User, Product, Order } from '../src/models.js';
import { migrateCatalogCopy } from '../src/catalog-copy.js';
import catalogCopy from '../src/catalog-copy-20261107.json' with { type: 'json' };
let mongo, store, app;
const origin = 'http://localhost:5173';
const password = 'Integracion1!';
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
  await customer.get('/api/admin/operations').expect(403);
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
    (await patch({ status: 'finalizado', estimatedReadyAt: eta, version: 0 }))
      .status,
    400,
  );
  assert.equal(
    (
      await patch({
        status: 'en_preparacion',
        estimatedReadyAt: '2020-01-01T00:00:00.000Z',
        version: 0,
      })
    ).status,
    400,
  );
  const updated = await patch({
    status: 'en_preparacion',
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
    version: created.body.__v,
  });
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.__v, 1);
  const stale = await mutate(admin, 'put', '/api/admin/products/' + id, {
    ...productData,
    name: 'Edición desactualizada',
    version: 0,
  });
  assert.equal(stale.status, 409);
  assert.equal((await Product.findById(id)).active, false);
  const catalog = await customer.get('/api/products');
  assert.equal(
    catalog.body.some((p) => p._id === id),
    false,
  );
  const state = await admin.get('/api/admin/operations').expect(200);
  assert.equal(state.body.integrations.recovery, false);
  assert.equal(state.body.failedNotifications, 0);
  assert.equal(state.body.sessionSecret, undefined);
  await User.updateOne(
    { email: 'admin@example.com' },
    { $set: { role: 'customer' } },
  );
  await admin.get('/api/admin/products').expect(403);
});
test('catálogo e historial paginan sin mezclar usuarios; el carrito recupera piezas fuera de página', async () => {
  const agent = request.agent(app);
  const registration = await register(agent, 'pagination@example.com');
  const products = await Product.create(
    Array.from({ length: 25 }, (_, i) => ({
      ...productData,
      name: 'Pieza ' + i,
      category: 'Paginación',
    })),
  );
  const first = await agent
    .get('/api/products?page=1&category=Paginaci%C3%B3n')
    .expect(200);
  const second = await agent
    .get('/api/products?page=2&category=Paginaci%C3%B3n')
    .expect(200);
  const third = await agent
    .get('/api/products?page=3&category=Paginaci%C3%B3n')
    .expect(200);
  assert.equal(first.body.products.length, 10);
  assert.equal(second.body.products.length, 10);
  assert.equal(third.body.products.length, 5);
  assert.equal(first.body.total, 25);
  assert.equal(first.body.pages, 3);
  assert.equal(
    new Set([...first.body.products, ...second.body.products, ...third.body.products].map((p) => p._id))
      .size,
    25,
  );
  const id = second.body.products[0]._id;
  const lookup = await agent.get('/api/products?ids=' + id).expect(200);
  assert.equal(lookup.body[0]._id, id);
  await Order.create(
    Array.from({ length: 21 }, () => ({
      userId: registration.body.id,
      items: [],
      totalCents: 0,
      currency: 'ARS',
    })),
  );
  const history = await agent.get('/api/orders?page=2').expect(200);
  assert.equal(history.body.total, 21);
  assert.equal(history.body.orders.length, 1);
  assert.equal(history.body.orders[0].userId, registration.body.id);
  assert.equal((await agent.get('/api/orders')).body.length, 20);
  for (const page of ['0', '-1', 'abc', '1000000']) {
    await agent.get('/api/products?page=' + page).expect(400);
    await agent.get('/api/orders?page=' + page).expect(400);
  }
  await agent
    .get('/api/products?ids=' + products.map((p) => p._id).join(','))
    .expect(400);
  await User.updateOne(
    { _id: registration.body.id },
    { $set: { role: 'admin' } },
  );
  const adminFirst = await agent.get('/api/admin/products?page=1').expect(200);
  const adminSecond = await agent.get('/api/admin/products?page=2').expect(200);
  assert.equal(adminFirst.body.products.length, 20);
  assert.ok(adminSecond.body.products.length > 0);
  assert.equal(
    new Set(
      [...adminFirst.body.products, ...adminSecond.body.products].map(
        (p) => p._id,
      ),
    ).size,
    adminFirst.body.total,
  );
  assert.equal((await agent.get('/api/admin/products')).body.length, 20);
  await agent.get('/api/admin/products?page=0').expect(400);
});
test('ficha pública muestra descripción y medidas sin sesión; ocultos e IDs inválidos responden 404', async () => {
  const p = await Product.create({
    ...productData,
    name: 'Ficha de producto',
    description: 'Descripción completa\ncon detalles de la pieza.',
  });
  const detail = await request(app)
    .get('/api/products/' + p._id)
    .expect(200);
  assert.equal(detail.body.description, p.description);
  assert.equal(detail.body.dimensions.width, productData.dimensions.width);
  assert.equal(detail.body.__v, undefined);
  await Product.updateOne({ _id: p._id }, { $set: { active: false } });
  await request(app)
    .get('/api/products/' + p._id)
    .expect(404);
  await request(app)
    .get('/api/products/' + new mongoose.Types.ObjectId())
    .expect(404);
  await request(app).get('/api/products/invalid-id').expect(404);
});

test('catalog copy migration separates summary and detail without overwriting later edits', async () => {
  const original = catalogCopy[0];
  const edited = catalogCopy[1];
  await Product.create([
    {
      ...productData,
      _id: original.id,
      description: original.previousDescription,
    },
    {
      ...productData,
      _id: edited.id,
      description: 'Descripción editada por administración',
    },
  ]);
  await migrateCatalogCopy();
  let product = await Product.findById(original.id).lean();
  assert.equal(product.shortDescription, original.shortDescription);
  assert.equal(product.description, original.description);
  assert.deepEqual(product.dimensions, productData.dimensions);
  const detail = await request(app)
    .get('/api/products/' + original.id)
    .expect(200);
  assert.equal(detail.body.shortDescription, original.shortDescription);
  assert.equal(detail.body.description, original.description);
  assert.equal(
    (await Product.findById(edited.id)).description,
    'Descripción editada por administración',
  );
  await Product.updateOne(
    { _id: original.id },
    {
      $set: { description: 'Detalle nuevo', shortDescription: 'Resumen nuevo' },
    },
  );
  await migrateCatalogCopy();
  product = await Product.findById(original.id).lean();
  assert.equal(product.shortDescription, 'Resumen nuevo');
  assert.equal(product.description, 'Detalle nuevo');
  await Product.deleteMany({ _id: { $in: [original.id, edited.id] } });
});
