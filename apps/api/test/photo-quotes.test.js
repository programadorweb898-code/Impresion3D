import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { User, PhotoQuote } from '../src/models.js';

const origin = 'http://localhost:5173';
let mongo, app, customer, other, admin, image;
async function register(email) {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/csrf')).body.token;
  await agent.post('/api/auth/register')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send({ name: 'Cliente de prueba', email, password: 'PruebaSegura1!' })
    .expect(201);
  return agent;
}
const metadata = (overrides = {}) => ({
  requestId: randomUUID(),
  quantity: 2,
  approximateSize: '15 cm de alto',
  details: 'Dos colores y una base',
  contact: { method: 'whatsapp', value: '+5491155555555' },
  contactConsent: true,
  ...overrides,
});
async function send(agent, data, buffer = image, filename = 'imagen.png') {
  const csrf = (await agent.get('/api/csrf')).body.token;
  return agent.post('/api/photo-quotes')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .field('metadata', JSON.stringify(data))
    .attach('image', buffer, filename);
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await PhotoQuote.init();
  app = createApp({
    sessionSecret: 'photo-request-test-secret-at-least-32-characters',
    webOrigin: origin,
  });
  image = await sharp({
    create: { width: 60, height: 80, channels: 3, background: '#8844cc' },
  }).png().toBuffer();
  customer = await register('photo-client@example.com');
  other = await register('photo-other@example.com');
  admin = await register('photo-admin@example.com');
  await User.updateOne({ email: 'photo-admin@example.com' }, { $set: { role: 'admin' } });
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('guarda imagen privada, contacto y evita duplicados ante reintentos', async () => {
  const data = metadata();
  const first = await send(customer, data);
  assert.equal(first.status, 201);
  assert.equal(first.body.quantity, 2);
  assert.equal(first.body.contact.method, 'whatsapp');
  assert.equal(first.body.contact.value, '+5491155555555');
  assert.equal(first.body.fileId, undefined);
  assert.equal(first.body.requestHash, undefined);
  const retry = await send(customer, data);
  assert.equal(retry.status, 200);
  assert.equal(retry.body._id, first.body._id);
  assert.equal(await PhotoQuote.countDocuments({ requestId: data.requestId }), 1);
  const ownImage = await customer.get('/api/photo-quotes/' + first.body._id + '/image').expect(200);
  assert.match(ownImage.headers['content-type'], /^image\/webp/);
  assert.equal(ownImage.headers['cache-control'], 'private, no-store');
  assert.ok(ownImage.body.length);
  await other.get('/api/photo-quotes/' + first.body._id + '/image').expect(404);
  await request(app).get('/api/photo-quotes/' + first.body._id + '/image').expect(401);
  await admin.get('/api/photo-quotes/' + first.body._id + '/image').expect(200);
  const otherList = await other.get('/api/photo-quotes').expect(200);
  assert.equal(otherList.body.total, 0);
  const conflict = await send(customer, { ...data, quantity: 3 });
  assert.equal(conflict.status, 409);
});

test('validaciones: imagen auténtica, datos y consentimiento de contacto', async () => {
  await request(app).get('/api/photo-quotes').expect(401);
  assert.equal((await send(other, metadata({ contactConsent: false }))).status, 400);
  assert.equal((await send(other, metadata({ quantity: 0 }))).status, 400);
  assert.equal((await send(other, metadata({ contact: { method: 'whatsapp', value: '011123456' } }))).status, 400);
  assert.equal((await send(other, metadata({ contact: { method: 'email', value: 'sin-arroba' } }))).status, 400);
  assert.equal((await send(other, metadata(), Buffer.from('not really an image'))).status, 400);
  const email = await send(other, metadata({ contact: { method: 'email', value: 'cliente@example.com' } }));
  assert.equal(email.status, 201);
  assert.equal(email.body.contact.method, 'email');
});

test('administración ve consulta, responde con control de versión; cliente ve respuesta', async () => {
  await other.get('/api/admin/photo-quotes').expect(403);
  const list = await admin.get('/api/admin/photo-quotes').expect(200);
  const row = list.body.requests.find((r) => r.contact.method === 'whatsapp');
  assert.ok(row);
  assert.equal(row.customer.email, 'photo-client@example.com');
  assert.equal(row.fileId, undefined);
  const csrf = (await admin.get('/api/csrf')).body.token;
  const values = {
    status: 'presupuestado',
    priceCents: 1250000,
    response: 'Incluye dos unidades. Consultá por los colores.',
    version: row.__v,
  };
  const update = await admin.patch('/api/admin/photo-quotes/' + row._id)
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send(values)
    .expect(200);
  assert.equal(update.body.priceCents, 1250000);
  await admin.patch('/api/admin/photo-quotes/' + row._id)
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send(values)
    .expect(409);
  const owner = await customer.get('/api/photo-quotes').expect(200);
  assert.equal(owner.body.requests[0].priceCents, 1250000);
  assert.match(owner.body.requests[0].response, /dos unidades/);
});
