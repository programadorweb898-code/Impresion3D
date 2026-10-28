import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
const directory = await mkdtemp(path.join(tmpdir(), 'impresion3d-static-'));
await mkdir(path.join(directory, 'assets'));
await writeFile(
  path.join(directory, 'index.html'),
  '<!doctype html><html lang="es"><body>Tienda</body></html>',
);
await writeFile(
  path.join(directory, 'assets', 'app-test.js'),
  'console.log("test");',
);
after(() => rm(directory, { recursive: true, force: true }));
const app = createApp({
  sessionSecret: 'test-deployment-secret-at-least-32-characters',
  webOrigin: 'https://example.com',
  production: true,
  trustProxy: true,
  staticDirectory: directory,
});
test('sirve frontend y rutas de React conservando errores JSON de la API', async () => {
  const home = await request(app).get('/').expect(200);
  assert.match(home.text, /Tienda/);
  const route = await request(app).get('/mis-pedidos').expect(200);
  assert.match(route.text, /Tienda/);
  await request(app)
    .get('/api/desconocida')
    .expect(404)
    .expect('Content-Type', /json/);
  await request(app).get('/assets/inexistente.js').expect(404);
  await request(app).get('/foto-inexistente.png').expect(404);
});
test('assets versionados tienen caché y respuestas privadas no', async () => {
  const asset = await request(app).get('/assets/app-test.js').expect(200);
  assert.match(asset.headers['cache-control'], /immutable/);
  const csrf = await request(app)
    .get('/api/csrf')
    .set('X-Forwarded-Proto', 'https')
    .expect(200);
  assert.equal(csrf.headers['cache-control'], 'no-store');
  assert.match(csrf.headers['set-cookie'][0], /HttpOnly/);
  assert.match(csrf.headers['set-cookie'][0], /Secure/);
  assert.match(csrf.headers['set-cookie'][0], /SameSite=Lax/);
});
test('readiness devuelve 503 sin conexión a MongoDB', async () => {
  await request(app).get('/api/ready').expect(503);
  await request(app).get('/api/health').expect(200);
});
