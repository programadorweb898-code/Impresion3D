import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import {
  User,
  DesignRequest,
  SlicerWorker,
  SlicingJob,
} from '../src/models.js';
import { tetraStl } from './helpers/model-fixtures.js';
let mongo, app, admin, customer, workerId, jobId, lease;
const origin = 'http://localhost:5173',
  secret = 'a'.repeat(64),
  profile = { id: 'pla-020', name: 'A1 PLA 0,20', material: 'PLA' };
async function register(email) {
  const agent = request.agent(app);
  const token = (await agent.get('/api/csrf')).body.token;
  await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .set('x-csrf-token', token)
    .send({ name: 'Prueba', email, password: 'PruebaSegura1!' })
    .expect(201);
  return agent;
}
async function mutate(agent, method, url, data) {
  const token = (await agent.get('/api/csrf')).body.token;
  return agent[method](url)
    .set('Origin', origin)
    .set('x-csrf-token', token)
    .send(data);
}
const worker = (method, url, body, key = secret, turn = lease) =>
  request(app)
    [method]('/api/slicer-worker' + url)
    .set('Authorization', 'Bearer ' + key)
    .set('x-slicing-lease', turn || '')
    .send(body);
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    DesignRequest.init(),
    SlicerWorker.init(),
    SlicingJob.init(),
  ]);
  app = createApp({
    sessionSecret: 'slicing-test-session-secret-at-least-32-characters',
    webOrigin: origin,
  });
  admin = await register('slicer-admin@example.com');
  await User.updateOne(
    { email: 'slicer-admin@example.com' },
    { $set: { role: 'admin' } },
  );
  customer = await register('slicer-customer@example.com');
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
test('vinculación usa código de un uso, no expone secreto, y mantiene CSRF y permisos', async () => {
  const download = await request(app)
    .get('/api/slicer-worker/download')
    .expect(200);
  assert.match(download.headers['content-disposition'], /mundo3d-worker.mjs/);
  await request(app).get('/api/slicer-worker/example').expect(200);
  assert.equal(
    (
      await mutate(customer, 'post', '/api/admin/slicing/workers', {
        name: 'PC',
      })
    ).status,
    403,
  );
  await admin
    .post('/api/admin/slicing/workers')
    .send({ name: 'PC' })
    .expect(403);
  const created = await mutate(admin, 'post', '/api/admin/slicing/workers', {
    name: 'PC de prueba',
  });
  assert.equal(created.status, 201);
  workerId = created.body.worker._id;
  const pair = await request(app)
    .post('/api/slicer-worker/pair')
    .send({ code: created.body.code, secret, profiles: [profile] })
    .expect(200);
  assert.equal(pair.body.workerId, workerId);
  await request(app)
    .post('/api/slicer-worker/pair')
    .send({ code: created.body.code, secret, profiles: [profile] })
    .expect(401);
  await admin.post('/api/slicer-worker/claim').send({}).expect(401);
  const connections = await admin.get('/api/admin/slicing/workers').expect(200);
  assert.equal(connections.body.workers[0].tokenHash, undefined);
  assert.equal(connections.body.workers[0].pairingHash, undefined);
  assert.equal(connections.body.workers[0].profiles[0].material, 'PLA');
});
test('cola privada, turno exclusivo, archivo exacto, estimación no publica precio', async () => {
  const token = (await customer.get('/api/csrf')).body.token;
  const response = await customer
    .post('/api/design-requests')
    .set('Origin', origin)
    .set('x-csrf-token', token)
    .field(
      'metadata',
      JSON.stringify({
        requestId: randomUUID(),
        quantity: 3,
        scale: 2,
        dimensions: { width: 2, height: 2, depth: 2 },
        colorStatus: 'missing',
        acceptedMissingColor: true,
        usage: '',
      }),
    )
    .attach('model', tetraStl(), 'pieza.stl')
    .expect(201);
  const id = response.body._id;
  assert.equal(
    (
      await mutate(customer, 'post', '/api/admin/slicing/requests/' + id, {
        workerId,
        profileId: profile.id,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await mutate(admin, 'post', '/api/admin/slicing/requests/' + id, {
        workerId,
        profileId: profile.id,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await mutate(admin, 'post', '/api/admin/slicing/requests/' + id, {
        workerId,
        profileId: profile.id,
      })
    ).status,
    409,
  );
  const claim = await worker('post', '/claim', {}).expect(200);
  jobId = claim.body.jobId;
  lease = claim.body.lease;
  assert.equal(claim.body.quantity, 3);
  assert.equal(claim.body.scale, 2);
  await worker('post', '/claim', {}).expect(204);
  await worker(
    'get',
    '/jobs/' + jobId + '/file',
    undefined,
    secret,
    'bad',
  ).expect(409);
  const file = await worker('get', '/jobs/' + jobId + '/file').expect(200);
  assert.deepEqual(file.body, tetraStl());
  await worker('post', '/jobs/' + jobId + '/heartbeat', {}).expect(204);
  await worker('post', '/jobs/' + jobId + '/result', {
    ok: true,
    grams: 12.5,
    seconds: 3600,
    plates: 1,
  }).expect(204);
  await worker('post', '/jobs/' + jobId + '/result', {
    ok: true,
    grams: 999,
    seconds: 999,
    plates: 1,
  }).expect(409);
  const stored = await DesignRequest.findById(id);
  assert.equal(stored.priceCents, null);
  assert.equal(stored.status, 'recibido');
  const own = await customer.get('/api/design-requests');
  assert.equal(own.body.requests[0].slicing, undefined);
  const all = await admin.get('/api/admin/design-requests');
  assert.equal(all.body.requests[0].slicing.result.grams, 12.5);
  assert.equal(all.body.requests[0].slicing.leaseHash, undefined);
});
test('recupera una PC desconectada sin aceptar resultados del turno anterior; revocación inmediata', async () => {
  await SlicingJob.updateOne(
    { _id: jobId },
    { $set: { state: 'queued', attempts: 0, result: null } },
  );
  const first = await worker('post', '/claim', {}).expect(200);
  await SlicingJob.updateOne(
    { _id: jobId },
    { $set: { leaseUntil: new Date(Date.now() - 1000) } },
  );
  const second = await worker('post', '/claim', {}).expect(200);
  assert.notEqual(first.body.lease, second.body.lease);
  await worker(
    'post',
    '/jobs/' + jobId + '/result',
    { ok: true, grams: 5, seconds: 60, plates: 1 },
    secret,
    first.body.lease,
  ).expect(409);
  await worker(
    'post',
    '/jobs/' + jobId + '/result',
    { ok: false, code: 'SLICER_FAILED' },
    secret,
    second.body.lease,
  ).expect(204);
  assert.equal(
    (await mutate(admin, 'delete', '/api/admin/slicing/workers/' + workerId))
      .status,
    204,
  );
  await worker('post', '/claim', {}).expect(401);
});
