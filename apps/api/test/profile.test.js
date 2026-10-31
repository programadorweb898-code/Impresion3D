import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import session from 'express-session';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User, SocialIdentity } from '../src/models.js';
let mongo;
const origin = 'http://localhost:5173',
  password = 'mi-clave-actual-segura',
  next = 'mi-clave-nueva-segura';
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), SocialIdentity.init()]);
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
function setup(services = { providers: {} }) {
  return createApp({
    sessionSecret: 'profile-test-secret-at-least-32-characters',
    webOrigin: origin,
    accountServices: services,
  });
}
async function mutate(agent, path, body, method = 'post') {
  const csrf = await agent.get('/api/csrf');
  return agent[method](path)
    .set('Origin', origin)
    .set('x-csrf-token', csrf.body.token)
    .send(body);
}
async function register(agent, email) {
  return mutate(agent, '/api/auth/register', {
    name: 'Cliente',
    email,
    password,
  });
}
test('perfil privado; sólo edita nombre propio y rechaza inyección de rol', async () => {
  const app = setup(),
    a = request.agent(app),
    b = request.agent(app);
  await request(app).get('/api/profile').expect(401);
  await register(a, 'profile-a@example.com');
  await register(b, 'profile-b@example.com');
  const profile = (await a.get('/api/profile').expect(200)).body;
  assert.equal(profile.hasPassword, true);
  assert.deepEqual(profile.providers, []);
  for (const key of [
    'passwordHash',
    'authVersion',
    'resetTokenHash',
    'pendingEmail',
  ])
    assert.equal(profile[key], undefined);
  assert.equal(
    (
      await mutate(
        a,
        '/api/profile',
        { name: 'Nombre nuevo', role: 'admin' },
        'patch',
      )
    ).status,
    400,
  );
  const update = await mutate(
    a,
    '/api/profile',
    { name: 'Nombre nuevo' },
    'patch',
  );
  assert.equal(update.status, 200);
  assert.equal(update.body.name, 'Nombre nuevo');
  assert.equal(update.body.role, 'customer');
  assert.equal((await b.get('/api/profile')).body.name, 'Cliente');
  await a.patch('/api/profile').send({ name: 'Sin CSRF' }).expect(403);
});
test('cambio de contraseña exige anterior e invalida otras sesiones', async () => {
  const app = setup(),
    a = request.agent(app),
    b = request.agent(app);
  await register(a, 'password-profile@example.com');
  await mutate(b, '/api/auth/login', {
    email: 'password-profile@example.com',
    password,
  });
  assert.equal(
    (
      await mutate(a, '/api/profile/password', {
        currentPassword: 'incorrecta',
        password: next,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await mutate(a, '/api/profile/password', {
        currentPassword: password,
        password: 'corta',
      })
    ).status,
    400,
  );
  const result = await mutate(a, '/api/profile/password', {
    currentPassword: password,
    password: next,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.passwordHash, undefined);
  await a.get('/api/auth/me').expect(200);
  await b.get('/api/auth/me').expect(401);
  assert.equal(
    (
      await mutate(b, '/api/auth/login', {
        email: 'password-profile@example.com',
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await mutate(b, '/api/auth/login', {
        email: 'password-profile@example.com',
        password: next,
      })
    ).status,
    200,
  );
});
test('email cambia sólo tras confirmar enlace privado de un uso; conserva id e invalida otras sesiones', async () => {
  const sent = [],
    app = setup({ providers: {}, sendEmailChange: async (d) => sent.push(d) }),
    a = request.agent(app),
    b = request.agent(app),
    stranger = request.agent(app);
  await register(a, 'old-email@example.com');
  await register(stranger, 'stranger-email@example.com');
  await mutate(b, '/api/auth/login', {
    email: 'old-email@example.com',
    password,
  });
  const id = (await a.get('/api/profile')).body.id;
  assert.equal(
    (
      await mutate(a, '/api/profile/email', {
        email: 'new-email@example.com',
        currentPassword: 'wrong',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await mutate(a, '/api/profile/email', {
        email: ' NEW-email@example.com ',
        currentPassword: password,
      })
    ).status,
    200,
  );
  assert.equal(
    (await a.get('/api/profile')).body.email,
    'old-email@example.com',
  );
  assert.equal(sent[0].email, 'new-email@example.com');
  const token = sent[0].url.split('#email=')[1];
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(
    (await User.findById(id).select('+emailChangeTokenHash'))
      .emailChangeTokenHash,
    token,
  );
  assert.equal(
    (await mutate(stranger, '/api/profile/email/confirm', { token })).status,
    400,
  );
  const confirmed = await mutate(a, '/api/profile/email/confirm', { token });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.user.email, 'new-email@example.com');
  assert.equal(confirmed.body.user.id, id);
  await b.get('/api/auth/me').expect(401);
  assert.equal(
    (await mutate(a, '/api/profile/email/confirm', { token })).status,
    400,
  );
  assert.equal(
    (
      await mutate(b, '/api/auth/login', {
        email: 'old-email@example.com',
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await mutate(b, '/api/auth/login', {
        email: 'new-email@example.com',
        password,
      })
    ).status,
    200,
  );
});
test('sin correo configurado o envío fallido no cambia email; rechaza duplicados, reenvíos y enlaces vencidos', async () => {
  const a = request.agent(setup());
  await register(a, 'no-mail@example.com');
  assert.equal(
    (
      await mutate(a, '/api/profile/email', {
        email: 'other-no-mail@example.com',
        currentPassword: password,
      })
    ).status,
    503,
  );
  const failed = request.agent(
    setup({
      providers: {},
      sendEmailChange: async () => {
        throw Error('secret provider error');
      },
    }),
  );
  await register(failed, 'failed-mail@example.com');
  const result = await mutate(failed, '/api/profile/email', {
    email: 'failed-new@example.com',
    currentPassword: password,
  });
  assert.equal(result.status, 502);
  assert.doesNotMatch(JSON.stringify(result.body), /secret/);
  assert.equal(
    (await failed.get('/api/profile')).body.email,
    'failed-mail@example.com',
  );
  const sent = [],
    ok = request.agent(
      setup({ providers: {}, sendEmailChange: async (d) => sent.push(d) }),
    );
  await register(ok, 'expired-mail@example.com');
  assert.equal(
    (
      await mutate(ok, '/api/profile/email', {
        email: 'no-mail@example.com',
        currentPassword: password,
      })
    ).status,
    409,
  );
  await mutate(ok, '/api/profile/email', {
    email: 'expired-new@example.com',
    currentPassword: password,
  });
  assert.equal(
    (
      await mutate(ok, '/api/profile/email', {
        email: 'again@example.com',
        currentPassword: password,
      })
    ).status,
    429,
  );
  await User.updateOne(
    { email: 'expired-mail@example.com' },
    { $set: { emailChangeExpiresAt: new Date(0) } },
  );
  assert.equal(
    (
      await mutate(ok, '/api/profile/email/confirm', {
        token: sent[0].url.split('#email=')[1],
      })
    ).status,
    400,
  );
});
test('usuarios anteriores a authVersion pueden actualizar nombre', async () => {
  const a = request.agent(setup());
  await register(a, 'legacy-profile@example.com');
  await User.updateOne(
    { email: 'legacy-profile@example.com' },
    { $unset: { authVersion: 1 } },
  );
  const result = await mutate(
    a,
    '/api/profile',
    { name: 'Nombre legacy' },
    'patch',
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.name, 'Nombre legacy');
});
test('social exige identidad reciente; reautenticación vuelve a perfil y no permite otra identidad', async () => {
  const store = new session.MemoryStore(),
    profile = {
      sub: 'social-profile-1',
      email: 'social-profile@example.com',
      email_verified: true,
      name: 'Social',
    };
  const services = {
    providers: { google: { clientId: 'id', clientSecret: 'secret' } },
    fetch: async (url) => ({
      ok: true,
      json: async () =>
        url.includes('/token') ? { access_token: 'token' } : profile,
    }),
  };
  const app = createApp({
      sessionStore: store,
      sessionSecret: 'profile-social-secret-at-least-32-chars',
      webOrigin: origin,
      accountServices: services,
    }),
    a = request.agent(app);
  const login = async (query = {}) => {
    const start = await a.get('/api/auth/google/start').query(query);
    const state = new URL(start.headers.location).searchParams.get('state');
    return a.get('/api/auth/google/callback').query({ state, code: 'code' });
  };
  await login();
  assert.equal((await a.get('/api/profile')).body.hasPassword, false);
  const sessions = await new Promise((resolve, reject) =>
    store.all((err, data) => (err ? reject(err) : resolve(data))),
  );
  for (const [id, data] of Object.entries(sessions)) {
    data.reauthenticatedAt = 1;
    await new Promise((resolve, reject) =>
      store.set(id, data, (err) => (err ? reject(err) : resolve())),
    );
  }
  assert.equal(
    (await mutate(a, '/api/profile/password', { password: next })).status,
    403,
  );
  assert.equal(
    (await login({ returnTo: 'profile', reauthenticate: '1' })).headers
      .location,
    '/perfil',
  );
  assert.equal(
    (await mutate(a, '/api/profile/password', { password: next })).status,
    200,
  );
  assert.equal((await a.get('/api/profile')).body.hasPassword, true);
  profile.sub = 'different-social-sub';
  profile.email = 'different-social@example.com';
  assert.equal(
    (await login({ returnTo: 'profile', reauthenticate: '1' })).headers
      .location,
    '/login?authError=existing',
  );
  assert.equal(await User.countDocuments({ email: profile.email }), 0);
  assert.equal(
    (await a.get('/api/profile')).body.email,
    'social-profile@example.com',
  );
});
