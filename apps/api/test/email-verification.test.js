import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models.js';
let mongo;
const origin = 'http://localhost:5173';
const password = 'password-inicial-12345';
const finalPassword = 'password-elegida-por-dueno';
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.init();
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
async function post(agent, path, body) {
  const { body: csrf } = await agent.get('/api/csrf');
  return agent
    .post('/api/auth/' + path)
    .set('Origin', origin)
    .set('x-csrf-token', csrf.token)
    .send(body);
}
const instance = (services) =>
  createApp({
    sessionSecret: 'verification-secret-with-at-least-32-characters',
    webOrigin: origin,
    accountServices: { providers: {}, ...services },
  });
test('registro pendiente no abre sesión; enlace de un uso confirma correo con contraseña elegida por su dueño', async () => {
  const mail = [];
  const app = instance({
    sendVerification: async (message) => mail.push(message),
  });
  const agent = request.agent(app);
  const registration = await post(agent, 'register', {
    name: 'Cliente',
    email: 'verify@example.com',
    password,
  });
  assert.equal(registration.status, 202);
  await agent.get('/api/auth/me').expect(401);
  assert.equal(
    (await post(agent, 'login', { email: 'verify@example.com', password })).body
      .code,
    'EMAIL_UNVERIFIED',
  );
  const token = new URL(mail[0].url).hash.slice('#verify='.length);
  const pending = await User.findOne({ email: 'verify@example.com' }).select(
    '+verificationTokenHash',
  );
  assert.notEqual(pending.verificationTokenHash, token);
  assert.equal(pending.verificationTokenHash.length, 64);
  const verified = await post(agent, 'verify-email', {
    token,
    password: finalPassword,
  });
  assert.equal(verified.status, 200);
  assert.equal((await User.findById(pending._id)).verificationRequired, false);
  assert.ok((await User.findById(pending._id)).emailVerifiedAt);
  assert.equal(
    (await post(agent, 'verify-email', { token, password })).status,
    400,
  );
  assert.equal(
    (await post(agent, 'login', { email: 'verify@example.com', password }))
      .status,
    401,
  );
  assert.equal(
    (
      await post(agent, 'login', {
        email: 'verify@example.com',
        password: finalPassword,
      })
    ).status,
    200,
  );
});
test('reenvío no enumera cuentas, limita frecuencia y permite recuperar un enlace vencido; confirma una sola solicitud concurrente', async () => {
  const mail = [],
    app = instance({ sendVerification: async (message) => mail.push(message) }),
    agent = request.agent(app);
  await post(agent, 'register', {
    name: 'Cliente',
    email: 'resend@example.com',
    password,
  });
  const token = new URL(mail[0].url).hash.slice('#verify='.length);
  await User.updateOne(
    { email: 'resend@example.com' },
    { $set: { verificationExpiresAt: new Date(0) } },
  );
  assert.equal(
    (await post(agent, 'verify-email', { token, password })).status,
    400,
  );
  const known = await post(agent, 'resend-verification', {
    email: 'resend@example.com',
  });
  const unknown = await post(agent, 'resend-verification', {
    email: 'missing@example.com',
  });
  assert.deepEqual(known.body, unknown.body);
  assert.equal(mail.length, 1);
  await User.updateOne(
    { email: 'resend@example.com' },
    { $set: { verificationRequestedAt: new Date(0) } },
  );
  await post(agent, 'resend-verification', { email: 'resend@example.com' });
  assert.equal(mail.length, 2);
  const nextToken = new URL(mail[1].url).hash.slice('#verify='.length);
  const csrf = (await agent.get('/api/csrf')).body.token;
  const verify = () =>
    agent
      .post('/api/auth/verify-email')
      .set('Origin', origin)
      .set('x-csrf-token', csrf)
      .send({ token: nextToken, password });
  const results = await Promise.all([verify(), verify()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
});
test('verificación exigida sin transporte no crea cuenta; fallo de entrega no habilita acceso ni filtra detalles', async () => {
  const agent = request.agent(instance({ requireEmailVerification: true }));
  assert.equal(
    (
      await post(agent, 'register', {
        name: 'Cliente',
        email: 'disabled@example.com',
        password,
      })
    ).status,
    503,
  );
  assert.equal(await User.countDocuments({ email: 'disabled@example.com' }), 0);
  const failing = request.agent(
    instance({
      sendVerification: async () => {
        throw new Error('secret provider details');
      },
    }),
  );
  const response = await post(failing, 'register', {
    name: 'Cliente',
    email: 'failure@example.com',
    password,
  });
  assert.equal(response.status, 202);
  assert.ok(!JSON.stringify(response.body).includes('secret'));
  assert.equal(
    (await post(failing, 'login', { email: 'failure@example.com', password }))
      .status,
    403,
  );
});
