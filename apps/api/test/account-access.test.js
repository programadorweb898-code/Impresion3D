import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import session from 'express-session';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { createAccountServices } from '../src/account-access.js';
import { User, SocialIdentity } from '../src/models.js';
let mongo;
const origin = 'http://localhost:5173',
  password = 'PruebaInicial1!',
  nextPassword = 'PruebaNueva2!';
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
    verification: false,
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
    .query({ state, code: 'one-use-provider-code', returnCheck: '1' });
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
    (await callback(wrong, 'google', state)).headers.location.split(
      '&authRef=',
    )[0],
    '/login?authError=cancelled',
  );
  assert.equal(services.calls.length, 0);
  const result = await callback(agent, 'google', state);
  assert.equal(result.headers.location, '/');
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.role, 'customer');
  assert.equal(
    (await callback(agent, 'google', state)).headers.location.split(
      '&authRef=',
    )[0],
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
    '/login?confirmGoogle=1',
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
    (await callback(agent, 'google', 'é'.repeat(64))).headers.location.split(
      '&authRef=',
    )[0],
    '/login?authError=cancelled',
  );
});
async function authorizeGoogleLink(
  agent,
  body = { currentPassword: password },
) {
  const csrf = await agent.get('/api/csrf');
  return agent
    .post('/api/profile/google-link')
    .set('Origin', origin)
    .set('x-csrf-token', csrf.body.token)
    .send(body);
}

test('vincular Google exige cuenta autenticada, CSRF y prueba del método original', async () => {
  const instance = app(socialServices('google', {}));
  const agent = request.agent(instance);
  await authorizeGoogleLink(agent).then((r) => assert.equal(r.status, 401));
  await register(agent, 'link-proof@example.com');
  await agent
    .post('/api/profile/google-link')
    .send({ currentPassword: password })
    .expect(403);
  assert.equal((await authorizeGoogleLink(agent, {})).status, 400);
  assert.equal(
    (await authorizeGoogleLink(agent, { currentPassword: 'incorrecta' }))
      .status,
    400,
  );
  assert.equal(
    (await agent.get('/api/auth/google/start?link=1')).headers.location,
    '/perfil?googleLink=expired',
  );
  assert.equal(
    await SocialIdentity.countDocuments({
      provider: 'google',
      userId: (await User.findOne({ email: 'link-proof@example.com' }))._id,
    }),
    0,
  );
});

test('vincula Google a la misma cuenta y conserva contraseña, rol y usuario; siguientes ingresos usan Google', async () => {
  const email = 'link-owner@gmail.com';
  const services = socialServices('google', {
    sub: 'link-owner-google',
    email,
    email_verified: true,
    name: 'Nombre Google diferente',
  });
  const instance = app(services),
    agent = request.agent(instance);
  await register(agent, email);
  const original = await User.findOneAndUpdate(
    { email },
    { $set: { role: 'admin' } },
    { new: true },
  ).select('+passwordHash');
  const proof = await authorizeGoogleLink(agent);
  assert.equal(proof.status, 200);
  assert.equal(proof.body.url, '/api/auth/google/start?link=1');
  const url = new URL((await agent.get(proof.body.url)).headers.location);
  assert.equal(url.searchParams.get('prompt'), 'select_account');
  const state = url.searchParams.get('state');
  assert.equal(
    (await callback(agent, 'google', state)).headers.location,
    '/perfil?googleLink=linked',
  );
  const linked = await SocialIdentity.findOne({
    provider: 'google',
    subject: 'link-owner-google',
  });
  assert.equal(String(linked.userId), String(original._id));
  const unchanged = await User.findById(original._id).select('+passwordHash');
  assert.equal(unchanged.passwordHash, original.passwordHash);
  assert.equal(unchanged.role, 'admin');
  assert.equal(unchanged.name, original.name);
  assert.equal(await User.countDocuments({ email }), 1);
  const nextAgent = request.agent(instance),
    nextStart = await start(nextAgent, 'google');
  await callback(nextAgent, 'google', nextStart.searchParams.get('state'));
  assert.equal(
    (await nextAgent.get('/api/auth/me')).body.id,
    String(original._id),
  );
  assert.equal((await nextAgent.get('/api/auth/me')).body.role, 'admin');
  assert.equal((await authorizeGoogleLink(agent)).status, 409);
  assert.match(
    (await callback(agent, 'google', state)).headers.location,
    /authError=cancelled/,
  );
  assert.equal(
    (await agent.get('/api/auth/google/start?link=1')).headers.location,
    '/perfil?googleLink=expired',
  );
});

test('vincular Google rechaza otra dirección, correo no verificado e identidad ya usada sin cambiar la sesión', async () => {
  const email = 'link-mismatch@example.com';
  const profile = {
    sub: 'link-wrong-google',
    email: 'other@example.com',
    email_verified: true,
  };
  const agent = request.agent(app(socialServices('google', profile)));
  await register(agent, email);
  const owner = (await agent.get('/api/auth/me')).body.id;
  async function attempt() {
    const proof = await authorizeGoogleLink(agent);
    const url = new URL((await agent.get(proof.body.url)).headers.location);
    return (await callback(agent, 'google', url.searchParams.get('state')))
      .headers.location;
  }
  assert.equal(await attempt(), '/perfil?googleLink=mismatch');
  profile.email = email;
  profile.email_verified = false;
  assert.equal(await attempt(), '/perfil?googleLink=mismatch');
  profile.email_verified = true;
  const other = await User.create({
    name: 'Otra cuenta',
    email: 'link-conflict@example.com',
  });
  await SocialIdentity.create({
    provider: 'google',
    subject: profile.sub,
    userId: other._id,
  });
  assert.equal(await attempt(), '/perfil?googleLink=conflict');
  assert.equal((await agent.get('/api/auth/me')).body.id, owner);
  assert.equal(await SocialIdentity.countDocuments({ userId: owner }), 0);
});

test('vincular Google invalida la prueba al cambiar contraseña o cerrar sesión y rechaza callback cancelado', async () => {
  const email = 'link-expired@example.com';
  const services = socialServices('google', {
    sub: 'link-expired-google',
    email,
    email_verified: true,
  });
  const instance = app(services),
    agent = request.agent(instance);
  await register(agent, email);
  await authorizeGoogleLink(agent);
  let url = new URL(
    (await agent.get('/api/auth/google/start?link=1')).headers.location,
  );
  await User.updateOne({ email }, { $inc: { authVersion: 1 } });
  assert.equal(
    (await callback(agent, 'google', url.searchParams.get('state'))).headers
      .location,
    '/perfil?googleLink=expired',
  );
  await post(agent, 'login', { email, password });
  await authorizeGoogleLink(agent);
  url = new URL(
    (await agent.get('/api/auth/google/start?link=1')).headers.location,
  );
  assert.equal(
    (
      await agent
        .get('/api/auth/google/callback')
        .query({ state: url.searchParams.get('state'), error: 'access_denied' })
    ).headers.location,
    '/perfil?googleLink=cancelled',
  );
  await authorizeGoogleLink(agent);
  url = new URL(
    (await agent.get('/api/auth/google/start?link=1')).headers.location,
  );
  await post(agent, 'logout', {});
  assert.match(
    (await callback(agent, 'google', url.searchParams.get('state'))).headers
      .location,
    /authError=cancelled/,
  );
  assert.equal(
    await SocialIdentity.countDocuments({ subject: 'link-expired-google' }),
    0,
  );
});

test('cuenta social exige reautenticación reciente y rechaza autorizaciones de vinculación vencidas', async () => {
  const email = 'link-social@example.com',
    store = new session.MemoryStore();
  const user = await User.create({ name: 'Cuenta Facebook', email });
  await SocialIdentity.create({
    provider: 'facebook',
    subject: 'link-social-facebook',
    userId: user._id,
  });
  const services = {
    providers: {
      google: { clientId: 'google-client', clientSecret: 'google-secret' },
      facebook: {
        clientId: 'facebook-client',
        clientSecret: 'facebook-secret',
      },
    },
    facebookVersion: 'v23.0',
    fetch: async (url) => ({
      ok: true,
      json: async () =>
        url.includes('/token') || url.includes('/oauth/access_token')
          ? { access_token: 'test-token' }
          : url.includes('openidconnect.googleapis.com')
            ? { sub: 'link-social-google', email, email_verified: true }
            : { id: 'link-social-facebook', email, name: 'Cuenta Facebook' },
    }),
  };
  const agent = request.agent(
    createApp({
      sessionStore: store,
      sessionSecret: 'social-link-test-secret-long-enough',
      webOrigin: origin,
      accountServices: services,
    }),
  );
  let url = await start(agent, 'facebook');
  await callback(agent, 'facebook', url.searchParams.get('state'));
  async function changeSession(change) {
    const sessions = await new Promise((resolve, reject) =>
      store.all((e, v) => (e ? reject(e) : resolve(v))),
    );
    for (const [id, value] of Object.entries(sessions)) {
      change(value);
      await new Promise((resolve, reject) =>
        store.set(id, value, (e) => (e ? reject(e) : resolve())),
      );
    }
  }
  await changeSession((value) => {
    value.reauthenticatedAt = 1;
  });
  assert.equal((await authorizeGoogleLink(agent, {})).status, 403);
  url = new URL(
    (await agent.get('/api/auth/facebook/start?reauthenticate=1')).headers
      .location,
  );
  await callback(agent, 'facebook', url.searchParams.get('state'));
  assert.equal((await authorizeGoogleLink(agent, {})).status, 200);
  await changeSession((value) => {
    value.googleLink.expires = 1;
  });
  assert.equal(
    (await agent.get('/api/auth/google/start?link=1')).headers.location,
    '/perfil?googleLink=expired',
  );
  await authorizeGoogleLink(agent, {});
  url = new URL(
    (await agent.get('/api/auth/google/start?link=1')).headers.location,
  );
  await changeSession((value) => {
    value.oauth.linkAccount.expires = 1;
  });
  assert.equal(
    (await callback(agent, 'google', url.searchParams.get('state'))).headers
      .location,
    '/perfil?googleLink=expired',
  );
  assert.equal(
    await SocialIdentity.countDocuments({
      provider: 'google',
      userId: user._id,
    }),
    0,
  );
  await authorizeGoogleLink(agent, {});
  url = new URL(
    (await agent.get('/api/auth/google/start?link=1')).headers.location,
  );
  assert.equal(
    (await callback(agent, 'google', url.searchParams.get('state'))).headers
      .location,
    '/perfil?googleLink=linked',
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
  assert.equal(url.searchParams.get('auth_type'), null);
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

test('fallos transitorios de OAuth dejan referencia y etapa sin registrar secretos; el siguiente intento usa un state nuevo', async (t) => {
  const logs = [];
  t.mock.method(console, 'warn', (line) => logs.push(JSON.parse(line)));
  for (const failure of ['timeout', 'profile']) {
    const services = socialServices('facebook', {
      id: 'diagnostic-' + failure,
      name: 'Cliente',
    });
    const transport = services.fetch;
    let fail = true;
    services.fetch = async (url, options) => {
      if (fail && failure === 'timeout')
        throw new DOMException('private token secret details', 'TimeoutError');
      if (
        fail &&
        failure === 'profile' &&
        new URL(url).pathname.endsWith('/me')
      )
        return { ok: false, status: 503 };
      return transport(url, options);
    };
    const agent = request.agent(app(services));
    const url = await start(agent, 'facebook');
    const result = await callback(
      agent,
      'facebook',
      url.searchParams.get('state'),
    );
    const destination = new URL(result.headers.location, origin);
    assert.equal(destination.searchParams.get('authError'), 'provider');
    assert.match(destination.searchParams.get('authRef'), /^[a-f0-9-]{36}$/);
    assert.equal(
      logs.at(-1).requestId,
      destination.searchParams.get('authRef'),
    );
    assert.equal(
      logs.at(-1).stage,
      failure === 'timeout' ? 'exchange' : 'profile',
    );
    assert.doesNotMatch(
      JSON.stringify(logs),
      /private token|provider-secret-token|server-secret|client_secret/,
    );
    await agent.get('/api/auth/me').expect(401);
    fail = false;
    const next = await start(agent, 'facebook');
    assert.notEqual(
      next.searchParams.get('state'),
      url.searchParams.get('state'),
    );
    assert.equal(
      (await callback(agent, 'facebook', next.searchParams.get('state')))
        .headers.location,
      '/',
    );
    await agent.get('/api/auth/me').expect(200);
  }
});

test('regreso sin cookie no reemplaza la sesión; comprobación del mismo origen recupera el intento y mantiene state obligatorio', async () => {
  const services = socialServices('facebook', {
    id: 'mobile-cookie-return',
    name: 'Cliente',
  });
  const instance = app(services),
    agent = request.agent(instance);
  const url = await start(agent, 'facebook');
  const state = url.searchParams.get('state');
  const landing = await request(instance)
    .get('/api/auth/facebook/callback')
    .query({ state, code: 'test-code' })
    .expect(200);
  assert.match(landing.text, /oauth-return.js/);
  assert.equal(landing.headers['set-cookie'], undefined);
  assert.equal(landing.headers['referrer-policy'], 'no-referrer');
  assert.equal(services.calls.length, 0);
  const valid = await callback(agent, 'facebook', state);
  assert.equal(valid.headers.location, '/');
  await agent.get('/api/auth/me').expect(200);
  const count = services.calls.length;
  const invalid = await request(instance)
    .get('/api/auth/facebook/callback')
    .query({ state, code: 'test-code', returnCheck: '1' })
    .expect(302);
  assert.match(invalid.headers.location, /authError=cancelled/);
  assert.equal(services.calls.length, count);
});

test('Google confirma contraseña en el login sin cambiar usuario ni anular el acceso original', async () => {
  const email = 'inline-password@example.com';
  const instance = app(
    socialServices('google', {
      sub: 'inline-password',
      email,
      email_verified: true,
    }),
  );
  const owner = request.agent(instance),
    agent = request.agent(instance),
    stranger = request.agent(instance);
  await register(owner, email);
  const id = (await owner.get('/api/auth/me')).body.id;
  await User.updateOne({ email }, { $set: { role: 'admin' } });
  const url = await start(agent, 'google');
  assert.equal(
    (await callback(agent, 'google', url.searchParams.get('state'))).headers
      .location,
    '/login?confirmGoogle=1',
  );
  await agent.get('/api/auth/me').expect(401);
  assert.deepEqual((await agent.get('/api/auth/google-confirmation')).body, {
    pending: true,
    email,
    hasPassword: true,
    facebook: false,
  });
  assert.equal(
    (await post(stranger, 'google-confirmation', { password })).status,
    409,
  );
  await agent
    .post('/api/auth/google-confirmation')
    .send({ password })
    .expect(403);
  assert.equal(
    (
      await post(agent, 'google-confirmation', {
        password,
        email: 'other@example.com',
      })
    ).status,
    400,
  );
  assert.equal(
    (await post(agent, 'google-confirmation', { password: 'wrong' })).status,
    400,
  );
  assert.equal(
    await SocialIdentity.countDocuments({ subject: 'inline-password' }),
    0,
  );
  assert.equal(
    (await post(agent, 'google-confirmation', { password })).status,
    200,
  );
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.id, id);
  assert.equal(me.body.role, 'admin');
  assert.equal(
    (await post(agent, 'google-confirmation', { password })).status,
    409,
  );
  assert.equal((await post(owner, 'login', { email, password })).status, 200);
  await post(agent, 'logout', {});
  const direct = await start(agent, 'google');
  assert.equal(
    (await callback(agent, 'google', direct.searchParams.get('state'))).headers
      .location,
    '/',
  );
  assert.equal((await agent.get('/api/auth/me')).body.id, id);
});

test('confirmación Google se invalida al cambiar contraseña, cancelar o cerrar sesión', async () => {
  const email = 'inline-invalid@example.com';
  const instance = app(
    socialServices('google', {
      sub: 'inline-invalid',
      email,
      email_verified: true,
    }),
  );
  const owner = request.agent(instance),
    agent = request.agent(instance);
  await register(owner, email);
  async function pending() {
    const url = await start(agent, 'google');
    await callback(agent, 'google', url.searchParams.get('state'));
  }
  await pending();
  await User.updateOne({ email }, { $inc: { authVersion: 1 } });
  assert.equal(
    (await post(agent, 'google-confirmation', { password })).status,
    409,
  );
  await pending();
  const csrf = (await agent.get('/api/csrf')).body.token;
  await agent
    .delete('/api/auth/google-confirmation')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .expect(200);
  assert.equal(
    (await post(agent, 'google-confirmation', { password })).status,
    409,
  );
  await pending();
  await post(agent, 'logout', {});
  assert.equal(
    (await post(agent, 'google-confirmation', { password })).status,
    409,
  );
  assert.equal(
    await SocialIdentity.countDocuments({ subject: 'inline-invalid' }),
    0,
  );
});

test('Facebook confirma únicamente la identidad original para habilitar Google', async () => {
  const email = 'inline-facebook@example.com';
  const google = { sub: 'inline-facebook-google', email, email_verified: true };
  const facebook = { id: 'inline-facebook-owner', name: 'Original' };
  const services = socialServices('google', google);
  services.providers.facebook = { clientId: 'fb', clientSecret: 'secret' };
  services.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.includes('/token') || url.includes('/oauth/access_token')
        ? { access_token: 'secret' }
        : url.includes('googleapis')
          ? google
          : facebook,
  });
  const instance = app(services),
    owner = request.agent(instance),
    agent = request.agent(instance);
  await register(owner, email);
  const user = await User.findOne({ email });
  await SocialIdentity.create({
    provider: 'facebook',
    subject: facebook.id,
    userId: user._id,
  });
  const url = await start(agent, 'google');
  await callback(agent, 'google', url.searchParams.get('state'));
  assert.equal(
    (await agent.get('/api/auth/google-confirmation')).body.facebook,
    true,
  );
  async function facebookStart() {
    return new URL(
      (await agent.get('/api/auth/facebook/start?confirmGoogle=1')).headers
        .location,
    ).searchParams.get('state');
  }
  let state = await facebookStart();
  facebook.id = 'unrelated-facebook';
  assert.equal(
    (await callback(agent, 'facebook', state)).headers.location,
    '/login?googleConfirmError=mismatch',
  );
  await agent.get('/api/auth/me').expect(401);
  assert.equal(
    await SocialIdentity.countDocuments({ subject: 'unrelated-facebook' }),
    0,
  );
  facebook.id = 'inline-facebook-owner';
  state = await facebookStart();
  assert.equal(
    (await callback(agent, 'facebook', state)).headers.location,
    '/',
  );
  assert.equal((await agent.get('/api/auth/me')).body.id, String(user._id));
  assert.equal(await SocialIdentity.countDocuments({ userId: user._id }), 2);
});

test('confirmación Google vence, detecta email cambiado y rechaza comprobación Facebook de un intento anterior', async () => {
  const email = 'inline-expiration@example.com';
  const store = new session.MemoryStore();
  const profile = { sub: 'inline-expiration', email, email_verified: true };
  const services = socialServices('google', profile);
  services.providers.facebook = { clientId: 'fb', clientSecret: 'secret' };
  services.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.includes('/token') || url.includes('/oauth/access_token')
        ? { access_token: 'secret' }
        : url.includes('googleapis')
          ? profile
          : { id: 'inline-expiration-fb' },
  });
  const instance = createApp({
    sessionSecret: 'inline-expiry-test-secret-at-least-32-characters',
    webOrigin: origin,
    accountServices: services,
    sessionStore: store,
  });
  const owner = request.agent(instance),
    agent = request.agent(instance);
  await register(owner, email);
  const user = await User.findOne({ email });
  await SocialIdentity.create({
    provider: 'facebook',
    subject: 'inline-expiration-fb',
    userId: user._id,
  });
  async function pending() {
    const url = await start(agent, 'google');
    await callback(agent, 'google', url.searchParams.get('state'));
  }
  async function mutate(fn) {
    const sessions = await new Promise((resolve, reject) =>
      store.all((e, v) => (e ? reject(e) : resolve(v))),
    );
    for (const [id, value] of Object.entries(sessions)) {
      if (!value.googleSignIn) continue;
      fn(value);
      await new Promise((resolve, reject) =>
        store.set(id, value, (e) => (e ? reject(e) : resolve())),
      );
    }
  }
  await pending();
  await mutate((value) => {
    value.googleSignIn.expires = 0;
  });
  assert.deepEqual((await agent.get('/api/auth/google-confirmation')).body, {
    pending: false,
  });
  assert.equal(
    (await post(agent, 'google-confirmation', { password })).status,
    409,
  );
  await pending();
  await User.updateOne(
    { _id: user._id },
    { $set: { email: 'changed-inline@example.com' } },
  );
  assert.equal(
    (await post(agent, 'google-confirmation', { password })).status,
    409,
  );
  await User.updateOne({ _id: user._id }, { $set: { email } });
  await pending();
  const fb = new URL(
    (await agent.get('/api/auth/facebook/start?confirmGoogle=1')).headers
      .location,
  );
  await mutate((value) => {
    value.googleSignIn.nonce = 'different-attempt';
  });
  assert.equal(
    (await callback(agent, 'facebook', fb.searchParams.get('state'))).headers
      .location,
    '/login?googleConfirmError=expired',
  );
  await agent.get('/api/auth/me').expect(401);
  assert.equal(
    await SocialIdentity.countDocuments({ subject: profile.sub }),
    0,
  );
});
