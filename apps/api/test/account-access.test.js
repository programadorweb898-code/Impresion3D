import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { createAccountServices } from '../src/account-access.js';
import { User, SocialIdentity } from '../src/models.js';
let mongo;
const origin = 'http://localhost:5173',
  password = 'mi-password-inicial-seguro',
  nextPassword = 'mi-nueva-clave-muy-segura';
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), SocialIdentity.init()]);
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
function app(services) {
  return createApp({
    sessionSecret: 'account-test-secret-at-least-32-characters',
    webOrigin: origin,
    accountServices: services,
  });
}
async function post(agent, path, body) {
  const csrf = await agent.get('/api/csrf');
  return agent
    .post('/api/auth/' + path)
    .set('Origin', origin)
    .set('x-csrf-token', csrf.body.token)
    .send(body);
}
async function register(agent, email) {
  return post(agent, 'register', { name: 'Cliente', email, password });
}
const disabled = { providers: {}, sendReset: null };
test('sin credenciales no habilita proveedores ni finge enviar correos', async () => {
  const instance = app(disabled),
    agent = request.agent(instance);
  assert.deepEqual((await agent.get('/api/auth/options')).body, {
    google: false,
    facebook: false,
    recovery: false,
  });
  assert.equal(
    (await post(agent, 'forgot-password', { email: 'test@example.com' }))
      .status,
    503,
  );
  assert.equal(
    (await agent.get('/api/auth/google/start')).headers.location,
    '/login?authError=unavailable',
  );
  await agent
    .post('/api/auth/forgot-password')
    .send({ email: 'test@example.com' })
    .expect(403);
});
test('recuperación guarda sólo hash, no enumera usuarios y limita reenvíos; enlace de un uso revoca sesiones anteriores', async () => {
  const sent = [],
    instance = app({
      providers: {},
      sendReset: async (data) => sent.push(data),
    }),
    alice = request.agent(instance),
    recovery = request.agent(instance),
    other = request.agent(instance);
  await register(alice, 'reset@example.com');
  await post(other, 'login', { email: 'reset@example.com', password });
  const known = await post(recovery, 'forgot-password', {
      email: 'reset@example.com',
    }),
    missing = await post(recovery, 'forgot-password', {
      email: 'missing@example.com',
    });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, missing.body);
  assert.equal(sent.length, 1);
  await post(recovery, 'forgot-password', { email: 'reset@example.com' });
  assert.equal(sent.length, 1);
  const token = sent[0].url.split('#reset=')[1];
  assert.match(token, /^[a-f0-9]{64}$/);
  const document = await User.findOne({ email: 'reset@example.com' }).select(
    '+resetTokenHash',
  );
  assert.notEqual(document.resetTokenHash, token);
  assert.equal(document.toObject().passwordHash, undefined);
  assert.equal(
    (await post(recovery, 'reset-password', { token, password: nextPassword }))
      .status,
    200,
  );
  await alice.get('/api/auth/me').expect(401);
  await other.get('/api/auth/me').expect(401);
  await recovery.get('/api/auth/me').expect(401);
  assert.equal(
    (await post(recovery, 'reset-password', { token, password: nextPassword }))
      .status,
    400,
  );
  assert.equal(
    (await post(recovery, 'login', { email: 'reset@example.com', password }))
      .status,
    401,
  );
  const login = await post(recovery, 'login', {
    email: 'reset@example.com',
    password: nextPassword,
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.authVersion, undefined);
  await recovery.get('/api/auth/me').expect(200);
});
test('rechaza enlaces vencidos y permite un solo cambio ante dos solicitudes simultáneas', async () => {
  const sent = [],
    instance = app({ providers: {}, sendReset: async (d) => sent.push(d) }),
    agent = request.agent(instance),
    second = request.agent(instance);
  await register(agent, 'expired@example.com');
  await post(agent, 'forgot-password', { email: 'expired@example.com' });
  const token = sent[0].url.split('#reset=')[1];
  await User.updateOne(
    { email: 'expired@example.com' },
    { $set: { resetExpiresAt: new Date(0) } },
  );
  assert.equal(
    (await post(agent, 'reset-password', { token, password: nextPassword }))
      .status,
    400,
  );
  await User.updateOne(
    { email: 'expired@example.com' },
    { $set: { resetExpiresAt: new Date(Date.now() + 60000) } },
  );
  const results = await Promise.all([
    post(agent, 'reset-password', { token, password: nextPassword }),
    post(second, 'reset-password', { token, password: nextPassword }),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 400]);
});
function socialServices(provider, profile) {
  const calls = [];
  return {
    calls,
    providers: {
      [provider]: { clientId: 'client-id', clientSecret: 'server-secret' },
    },
    facebookVersion: 'v23.0',
    sendReset: null,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/token') || url.includes('/oauth/access_token'))
        return {
          ok: true,
          json: async () => ({ access_token: 'provider-secret-token' }),
        };
      return { ok: true, json: async () => profile };
    },
  };
}
async function start(agent, provider) {
  const result = await agent
    .get('/api/auth/' + provider + '/start')
    .expect(302);
  return new URL(result.headers.location);
}
async function callback(agent, provider, state) {
  return agent
    .get('/api/auth/' + provider + '/callback')
    .query({ state, code: 'one-use-provider-code' });
}
test('Google usa state por sesión y PKCE; crea cliente y reutiliza identidad sin almacenar tokens', async () => {
  const services = socialServices('google', {
      sub: 'google-123',
      email: 'google@example.com',
      email_verified: true,
      name: 'Google User',
    }),
    instance = app(services),
    agent = request.agent(instance);
  const url = await start(agent, 'google');
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('client_secret'), null);
  const state = url.searchParams.get('state');
  const wrong = request.agent(instance);
  assert.equal(
    (await callback(wrong, 'google', state)).headers.location,
    '/login?authError=cancelled',
  );
  assert.equal(services.calls.length, 0);
  const result = await callback(agent, 'google', state);
  assert.equal(result.headers.location, '/');
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.role, 'customer');
  assert.equal(
    (await callback(agent, 'google', state)).headers.location,
    '/login?authError=cancelled',
  );
  assert.ok(services.calls[0].options.body.get('code_verifier'));
  assert.equal(
    services.calls[0].options.body.get('redirect_uri'),
    origin + '/api/auth/google/callback',
  );
  const url2 = await start(agent, 'google');
  await callback(agent, 'google', url2.searchParams.get('state'));
  assert.equal(
    await SocialIdentity.countDocuments({ subject: 'google-123' }),
    1,
  );
  assert.equal(await User.countDocuments({ email: 'google@example.com' }), 1);
  assert.equal(
    (
      await User.findOne({ email: 'google@example.com' }).select(
        '+passwordHash',
      )
    ).passwordHash,
    undefined,
  );
  assert.equal(
    (await post(agent, 'login', { email: 'google@example.com', password }))
      .status,
    401,
  );
});
test('Google no vincula por email ni acepta email sin verificar y rechaza state manipulado', async () => {
  const profile = {
      sub: 'wrong-identity',
      email: 'existing@example.com',
      email_verified: true,
      name: 'Other',
    },
    services = socialServices('google', profile),
    instance = app(services),
    agent = request.agent(instance);
  await register(agent, 'existing@example.com');
  let url = await start(agent, 'google');
  assert.equal(
    (await callback(agent, 'google', url.searchParams.get('state'))).headers
      .location,
    '/login?authError=existing',
  );
  assert.equal(
    await SocialIdentity.countDocuments({ subject: 'wrong-identity' }),
    0,
  );
  profile.email = 'unverified@example.com';
  profile.email_verified = false;
  url = await start(agent, 'google');
  assert.equal(
    (await callback(agent, 'google', url.searchParams.get('state'))).headers
      .location,
    '/login?authError=email',
  );
  assert.equal(await User.countDocuments({ email: profile.email }), 0);
  url = await start(agent, 'google');
  assert.equal(
    (await callback(agent, 'google', 'é'.repeat(64))).headers.location,
    '/login?authError=cancelled',
  );
});
test('Facebook solicita email y usa appsecret_proof sin exponer el token en URL', async () => {
  const services = socialServices('facebook', {
      id: 'facebook-123',
      email: 'facebook@example.com',
      name: 'Facebook User',
    }),
    agent = request.agent(app(services));
  const url = await start(agent, 'facebook');
  assert.equal(url.origin, 'https://www.facebook.com');
  assert.equal(url.searchParams.get('scope'), 'email,public_profile');
  assert.equal(
    (await callback(agent, 'facebook', url.searchParams.get('state'))).headers
      .location,
    '/',
  );
  await agent.get('/api/auth/me').expect(200);
  const profileCall = services.calls[1],
    profileUrl = new URL(profileCall.url);
  assert.match(
    profileUrl.searchParams.get('appsecret_proof'),
    /^[a-f0-9]{64}$/,
  );
  assert.equal(profileUrl.searchParams.get('access_token'), null);
  assert.equal(
    profileCall.options.headers.Authorization,
    'Bearer provider-secret-token',
  );
});
test('fallo al enviar correo no revela si existe la cuenta; Resend usa un remitente y destino del servidor', async () => {
  const transportCalls = [];
  const services = createAccountServices(
    {
      RESEND_API_KEY: 'email-secret',
      EMAIL_FROM: 'Shop <cuentas@example.com>',
    },
    async (...args) => {
      transportCalls.push(args);
      return { ok: true };
    },
  );
  await services.sendReset({
    email: 'client@example.com',
    url: origin + '/login#reset=test',
  });
  assert.equal(
    transportCalls[0][1].headers.Authorization,
    'Bearer email-secret',
  );
  assert.deepEqual(JSON.parse(transportCalls[0][1].body).to, [
    'client@example.com',
  ]);
  const agent = request.agent(
    app({
      providers: {},
      sendReset: async () => {
        throw Error('private provider message');
      },
    }),
  );
  await register(agent, 'delivery@example.com');
  const response = await post(agent, 'forgot-password', {
    email: 'delivery@example.com',
  });
  assert.equal(response.status, 200);
  assert.doesNotMatch(JSON.stringify(response.body), /private/);
});
