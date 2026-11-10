import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { User, DesignRequest } from '../src/models.js';
import { coloredThreeMf } from './helpers/three-mf-fixtures.js';
let mongo, app, customer, other, admin;
const origin = 'http://localhost:5173';
async function register(email) {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/csrf')).body.token;
  await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send({ name: 'Cliente de prueba', email, password: 'PruebaSegura1!' })
    .expect(201);
  return agent;
}
const original = coloredThreeMf();
const metadata = (overrides = {}) => ({
  requestId: randomUUID(),
  quantity: 2,
  scale: 1.5,
  dimensions: { width: 90, height: 60, depth: 45 },
  colorStatus: 'missing',
  acceptedMissingColor: true,
  usage: 'Decoración',
  ...overrides,
});
async function send(agent, data, buffer = original, name = 'mi-modelo.3mf') {
  const csrf = (await agent.get('/api/csrf')).body.token;
  return agent
    .post('/api/design-requests')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .field('metadata', JSON.stringify(data))
    .attach('model', buffer, name);
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await DesignRequest.init();
  app = createApp({
    sessionSecret: 'design-request-test-secret-at-least-32-characters',
    webOrigin: origin,
  });
  customer = await register('design-client@example.com');
  other = await register('design-other@example.com');
  admin = await register('design-admin@example.com');
  await User.updateOne(
    { email: 'design-admin@example.com' },
    { $set: { role: 'admin' } },
  );
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('solicitud conserva archivo original, datos y privacidad; reintentos no duplican', async () => {
  const data = metadata();
  const first = await send(customer, data);
  assert.equal(first.status, 201);
  assert.equal(first.body.quantity, 2);
  assert.equal(first.body.fileId, undefined);
  assert.equal(first.body.requestHash, undefined);
  const retry = await send(customer, data);
  assert.equal(retry.status, 200);
  assert.equal(retry.body._id, first.body._id);
  assert.equal(
    await DesignRequest.countDocuments({ requestId: data.requestId }),
    1,
  );
  const file = await customer
    .get('/api/design-requests/' + first.body._id + '/file')
    .expect(200);
  assert.deepEqual(file.body, original);
  assert.match(file.headers['content-disposition'], /attachment/);
  assert.equal(file.headers['cache-control'], 'no-store');
  await other
    .get('/api/design-requests/' + first.body._id + '/file')
    .expect(404);
  await request(app)
    .get('/api/design-requests/' + first.body._id + '/file')
    .expect(401);
  const list = await other.get('/api/design-requests');
  assert.equal(list.body.total, 0);
  const different = await send(customer, { ...data, quantity: 3 });
  assert.equal(different.status, 409);
  await admin
    .get('/api/design-requests/' + first.body._id + '/file')
    .expect(200);
});
test('exige sesión, CSRF, confirmación de color y metadatos válidos', async () => {
  await request(app).post('/api/design-requests').expect(403);
  const noColor = await send(
    customer,
    metadata({ acceptedMissingColor: false }),
  );
  assert.equal(noColor.status, 409);
  assert.equal(noColor.body.code, 'COLOR_CONFIRMATION_REQUIRED');
  const bad = await send(other, metadata({ quantity: 0 }));
  assert.equal(bad.status, 400);
  const malformed = await send(
    other,
    metadata(),
    Buffer.from('no es un modelo'),
  );
  assert.equal(malformed.status, 400);
  const unknown = await send(
    other,
    metadata({ colorStatus: 'unknown', acceptedMissingColor: false }),
  );
  assert.equal(unknown.status, 409);
});
test('administración responde con presupuesto versionado; cliente solo consulta su solicitud', async () => {
  await other.get('/api/admin/design-requests').expect(403);
  const list = await admin.get('/api/admin/design-requests').expect(200);
  const row = list.body.requests[0];
  assert.equal(row.customer.email, 'design-client@example.com');
  const csrf = (await admin.get('/api/csrf')).body.token;
  const values = {
    status: 'presupuestado',
    priceCents: 125000,
    response: 'Incluye dos unidades en PLA.',
    version: row.__v,
  };
  await admin
    .patch('/api/admin/design-requests/' + row._id)
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send(values)
    .expect(200);
  await admin
    .patch('/api/admin/design-requests/' + row._id)
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send(values)
    .expect(409);
  const own = await customer.get('/api/design-requests').expect(200);
  assert.equal(own.body.requests[0].priceCents, 125000);
  assert.match(own.body.requests[0].response, /dos unidades/);
});

test('dos envíos concurrentes no superan el cupo de solicitudes abiertas en la instancia', async () => {
  const agent = await register('quota-client@example.com');
  const user = await User.findOne({ email: 'quota-client@example.com' });
  await DesignRequest.insertMany(
    Array.from({ length: 19 }, () => ({
      ...metadata(),
      userId: user._id,
      fileId: new mongoose.Types.ObjectId(),
      requestHash: 'fixture',
    })),
  );
  const token = (await agent.get('/api/csrf')).body.token;
  const post = () =>
    agent
      .post('/api/design-requests')
      .set('Origin', origin)
      .set('x-csrf-token', token)
      .field('metadata', JSON.stringify(metadata()))
      .attach('model', original, 'modelo.3mf');
  const responses = await Promise.all([post(), post()]);
  assert.equal(responses.filter((r) => r.status === 201).length, 1);
  assert.ok(responses.some((r) => [409, 429].includes(r.status)));
  assert.equal(
    await DesignRequest.countDocuments({
      userId: user._id,
      status: { $ne: 'cerrado' },
    }),
    20,
  );
});
