import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../../web/src/api.js';
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
test('foto multipart lleva sesión y token; el navegador define Content-Type', async () => {
  const form = new FormData();
  form.append('image', new Blob(['photo'], { type: 'image/png' }), 'photo.png');
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1
      ? Response.json({ token: 'csrf-token' })
      : Response.json({ image: { url: 'photo-url' } });
  };
  await api('/admin/products/test/image', { method: 'POST', body: form });
  assert.equal(calls[0].url, '/api/csrf');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[1].url, '/api/admin/products/test/image');
  assert.equal(calls[1].options.body, form);
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.equal(calls[1].options.headers.get('x-csrf-token'), 'csrf-token');
  assert.equal(calls[1].options.headers.has('Content-Type'), false);
});
test('si falla verificar la sesión no se envía el archivo', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(
    () =>
      api('/admin/products/test/image', {
        method: 'POST',
        body: new FormData(),
      }),
    /verificar la sesión/,
  );
  assert.equal(calls, 1);
});
test('una subida interrumpida informa el paso y nunca se reintenta automáticamente', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return Response.json({ token: 'token' });
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(
    () =>
      api('/admin/products/test/image', {
        method: 'POST',
        body: new FormData(),
      }),
    /No se pudo enviar la foto/,
  );
  assert.equal(calls, 2);
});
test('errores HTTP conservan el mensaje y la referencia sin mostrar HTML', async () => {
  globalThis.fetch = async () =>
    Response.json(
      { message: 'Error de almacenamiento' },
      { status: 502, headers: { 'x-request-id': 'request-123' } },
    );
  await assert.rejects(
    () => api('/test'),
    /Error de almacenamiento.*request-123/,
  );
  globalThis.fetch = async () =>
    new Response('<html>gateway</html>', { status: 502 });
  await assert.rejects(() => api('/test'), /respuesta válida \(HTTP 502\)/);
});
