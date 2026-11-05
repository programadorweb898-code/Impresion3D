import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User, SocialIdentity, Product, Order } from '../src/models.js';

let mongo;
const origin = 'http://localhost:5173';
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), SocialIdentity.init(), Order.init()]);
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
function setup(profile, extras = {}) {
  const calls = [];
  const app = createApp({
    sessionSecret: 'facebook-identity-tests-long-session-secret',
    webOrigin: origin,
    accountServices: {
      providers: {
        facebook: { clientId: 'test-id', clientSecret: 'test-secret' },
      },
      facebookVersion: 'v26.0',
      fetch: async (url) => {
        calls.push(url);
        return {
          ok: true,
          json: async () =>
            url.includes('/oauth/access_token')
              ? { access_token: 'test-provider-token' }
              : profile,
        };
      },
      ...extras,
    },
  });
  return { app, calls };
}
async function login(agent, query = {}) {
  const start = await agent
    .get('/api/auth/facebook/start')
    .query(query)
    .expect(302);
  const state = new URL(start.headers.location).searchParams.get('state');
  return agent
    .get('/api/auth/facebook/callback')
    .query({ state, code: 'test-code' })
    .expect(302);
}
async function post(agent, path, body) {
  const csrf = await agent.get('/api/csrf');
  return agent
    .post(path)
    .set('Origin', origin)
    .set('x-csrf-token', csrf.body.token)
    .send(body);
}
test('Facebook sin email admite distintos clientes y conserva cuenta, sesión y pedidos por identidad', async () => {
  const profile = { id: 'no-email-first', name: 'Cliente Facebook' };
  const { app, calls } = setup(profile);
  const first = request.agent(app),
    second = request.agent(app);
  assert.equal((await login(first)).headers.location, '/');
  const account = (await first.get('/api/auth/me').expect(200)).body;
  assert.equal(account.role, 'customer');
  const stored = await User.findById(account.id).select('+passwordHash').lean();
  assert.equal(Object.hasOwn(stored, 'email'), false);
  assert.equal(stored.passwordHash, undefined);
  assert.equal(stored.emailVerifiedAt, undefined);
  const product = await Product.create({
    name: 'Pieza',
    priceCents: 500,
    active: true,
  });
  const order = await post(first, '/api/orders', {
    items: [{ productId: String(product._id), quantity: 2 }],
  });
  assert.equal(order.status, 201);
  assert.equal(order.body.userId, account.id);
  await first.get('/api/admin/orders').expect(403);

  profile.id = 'no-email-second';
  assert.equal((await login(second)).headers.location, '/');
  const other = (await second.get('/api/auth/me').expect(200)).body;
  assert.notEqual(other.id, account.id);
  assert.deepEqual((await second.get('/api/orders').expect(200)).body, []);
  profile.id = 'no-email-first';
  await post(first, '/api/auth/logout', {});
  await first.get('/api/auth/me').expect(401);
  assert.equal((await login(first)).headers.location, '/');
  assert.equal((await first.get('/api/auth/me')).body.id, account.id);
  assert.equal((await first.get('/api/orders')).body[0]._id, order.body._id);
  assert.equal(
    await SocialIdentity.countDocuments({
      provider: 'facebook',
      subject: profile.id,
    }),
    1,
  );
  assert.equal(
    calls.some((url) => url.includes('/permissions')),
    false,
  );
});
test('Facebook sin email válido no inventa direcciones y no depende del permiso email', async () => {
  for (const [index, email] of [
    undefined,
    null,
    '',
    'invalid-email',
    {},
    123,
  ].entries()) {
    const { app } = setup({ id: 'invalid-email-' + index, email, name: ' ' });
    const agent = request.agent(app);
    assert.equal((await login(agent)).headers.location, '/');
    const me = (await agent.get('/api/auth/me').expect(200)).body;
    assert.equal(me.name, 'Cliente');
    assert.equal(
      Object.hasOwn(await User.findById(me.id).lean(), 'email'),
      false,
    );
  }
});
test('un email coincidente nunca vincula otra cuenta y un acceso posterior no reemplaza el correo', async () => {
  const existing = await User.create({
    name: 'Dueño',
    email: 'owner@example.com',
    role: 'admin',
  });
  const profile = { id: 'independent-facebook', name: 'Otro cliente' };
  const { app } = setup(profile);
  const agent = request.agent(app);
  await login(agent);
  const id = (await agent.get('/api/auth/me')).body.id;
  profile.email = existing.email;
  await login(agent);
  const me = (await agent.get('/api/auth/me')).body;
  assert.equal(me.id, id);
  assert.notEqual(me.id, String(existing._id));
  assert.equal(me.role, 'customer');
  assert.equal(me.email, undefined);
  profile.id = 'different-facebook';
  const stranger = request.agent(app);
  assert.equal(
    (await login(stranger)).headers.location,
    '/login?authError=existing',
  );
  await stranger.get('/api/auth/me').expect(401);
  assert.equal(await SocialIdentity.countDocuments({ subject: profile.id }), 0);
});
test('state, perfil válido e identidad original siguen siendo obligatorios', async () => {
  const profile = { name: 'Sin identificador' };
  const { app, calls } = setup(profile);
  const agent = request.agent(app);
  const count = await User.countDocuments();
  assert.equal(
    (await login(agent)).headers.location.split('&authRef=')[0],
    '/login?authError=provider',
  );
  assert.equal(await User.countDocuments(), count);
  await agent.get('/api/auth/me').expect(401);
  const start = await agent.get('/api/auth/facebook/start');
  const state = new URL(start.headers.location).searchParams.get('state');
  const callsBefore = calls.length;
  await request
    .agent(app)
    .get('/api/auth/facebook/callback')
    .query({ state, code: 'test' });
  assert.equal(calls.length, callsBefore);
  await agent
    .get('/api/auth/facebook/callback')
    .query({ state, error: 'access_denied' });
  assert.equal(calls.length, callsBefore);
  profile.id = 'reauth-original';
  await login(agent);
  const id = (await agent.get('/api/auth/me')).body.id;
  profile.id = 'reauth-other';
  assert.equal(
    (await login(agent, { reauthenticate: '1', returnTo: 'profile' })).headers
      .location,
    '/login?authError=existing',
  );
  assert.equal((await agent.get('/api/auth/me')).body.id, id);
  assert.equal(await SocialIdentity.countDocuments({ subject: profile.id }), 0);
});
test('dos primeros accesos simultáneos sin correo usan la misma cuenta y no dejan usuarios huérfanos', async () => {
  const profile = { id: 'concurrent-facebook', name: 'Cliente' };
  const { app } = setup(profile);
  const a = request.agent(app),
    b = request.agent(app);
  const count = await User.countDocuments();
  const results = await Promise.all([login(a), login(b)]);
  assert.deepEqual(
    results.map((result) => result.headers.location),
    ['/', '/'],
  );
  assert.equal(
    (await a.get('/api/auth/me')).body.id,
    (await b.get('/api/auth/me')).body.id,
  );
  assert.equal(await User.countDocuments(), count + 1);
  assert.equal(await SocialIdentity.countDocuments({ subject: profile.id }), 1);
});
test('correo inicial requiere enlace privado; preserva identidad y revoca sesiones al confirmarlo', async () => {
  const sent = [];
  const { app } = setup(
    { id: 'facebook-add-email', name: 'Cliente' },
    { sendEmailChange: async (mail) => sent.push(mail) },
  );
  const a = request.agent(app),
    b = request.agent(app),
    stranger = request.agent(app);
  await login(a);
  await login(b);
  const initial = (await a.get('/api/profile')).body;
  assert.equal(initial.email, null);
  assert.equal(initial.canUpdateEmail, true);
  const password = 'PruebaCorreo1!';
  assert.equal(
    (await post(a, '/api/profile/password', { password })).body.code,
    'EMAIL_REQUIRED',
  );
  await a
    .post('/api/profile/email')
    .send({ email: 'contact@example.com' })
    .expect(403);
  assert.equal(
    (await post(a, '/api/profile/email', { email: 'owner@example.com' }))
      .status,
    409,
  );
  assert.equal(
    (await post(a, '/api/profile/email', { email: ' Contact@example.com ' }))
      .status,
    200,
  );
  assert.equal(sent.length, 1);
  assert.equal((await a.get('/api/profile')).body.email, null);
  const token = sent[0].url.split('#email=')[1];
  assert.equal(
    (await post(stranger, '/api/profile/email/confirm', { token })).status,
    401,
  );
  const confirmed = await post(a, '/api/profile/email/confirm', { token });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.user.id, initial.id);
  assert.equal(confirmed.body.user.email, 'contact@example.com');
  assert.ok((await User.findById(initial.id)).emailVerifiedAt);
  await b.get('/api/auth/me').expect(401);
  assert.equal(
    (await post(a, '/api/profile/email/confirm', { token })).status,
    400,
  );
  await login(a);
  assert.equal((await a.get('/api/profile')).body.email, 'contact@example.com');
  assert.equal(
    (await post(a, '/api/profile/password', { password })).status,
    200,
  );
  assert.equal(
    (
      await post(stranger, '/api/auth/login', {
        email: 'contact@example.com',
        password,
      })
    ).status,
    200,
  );
  assert.equal((await stranger.get('/api/auth/me')).body.id, initial.id);
});
test('sin servicio de correo el acceso funciona pero no agrega emails sin verificar', async () => {
  const { app } = setup({ id: 'facebook-no-mailer', name: 'Cliente' });
  const agent = request.agent(app);
  await login(agent);
  const profile = (await agent.get('/api/profile').expect(200)).body;
  assert.equal(profile.canUpdateEmail, false);
  assert.equal(
    (
      await post(agent, '/api/profile/email', {
        email: 'unverified@example.com',
      })
    ).status,
    503,
  );
  assert.equal((await agent.get('/api/profile')).body.email, null);
  assert.equal((await User.findById(profile.id)).emailVerifiedAt, undefined);
});
