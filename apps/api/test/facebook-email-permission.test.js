import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facebookEmailPermission } from '../src/facebook-email-permission.js';

const config = {
  version: 'v26.0',
  clientSecret: 'private-app-secret',
  accessToken: 'private-user-token',
};
test('consulta el permiso email firmado sin incluir el token ni el secreto en la URL', async () => {
  const calls = [];
  const result = await facebookEmailPermission({
    ...config,
    transport: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          data: [
            { permission: 'public_profile', status: 'granted' },
            { permission: 'email', status: 'granted' },
          ],
        }),
      };
    },
  });
  assert.equal(result, 'granted');
  const { url, options } = calls[0];
  assert.equal(new URL(url).pathname, '/v26.0/me/permissions');
  assert.match(
    new URL(url).searchParams.get('appsecret_proof'),
    /^[a-f0-9]{64}$/,
  );
  assert.doesNotMatch(url, /private-/);
  assert.equal(options.headers.Authorization, 'Bearer private-user-token');
  assert.ok(options.signal instanceof AbortSignal);
});
test('distingue permisos rechazados, vencidos y ausentes sin inferir que el perfil tiene email', async () => {
  for (const status of ['declined', 'expired']) {
    assert.equal(
      await facebookEmailPermission({
        ...config,
        transport: async () => ({
          ok: true,
          json: async () => ({ data: [{ permission: 'email', status }] }),
        }),
      }),
      status,
    );
  }
  assert.equal(
    await facebookEmailPermission({
      ...config,
      transport: async () => ({
        ok: true,
        json: async () => ({
          data: [{ permission: 'public_profile', status: 'granted' }],
        }),
      }),
    }),
    'not_granted',
  );
});
test('errores y respuestas inesperadas no exponen datos ni convierten un fallo de diagnóstico en un permiso rechazado', async () => {
  for (const transport of [
    async () => {
      throw new Error('private transport error');
    },
    async () => ({ ok: false }),
    async () => ({
      ok: true,
      json: async () => ({ error: { message: 'private provider error' } }),
    }),
    async () => ({
      ok: true,
      json: async () => ({
        data: [{ permission: 'email', status: 'private-value' }],
      }),
    }),
  ])
    assert.equal(
      await facebookEmailPermission({ ...config, transport }),
      'unknown',
    );
});
