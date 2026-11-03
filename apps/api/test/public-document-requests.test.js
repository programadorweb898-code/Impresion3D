import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { observePublicDocuments } from '../src/public-document-requests.js';

test('registra entrada y respuesta de documentos públicos, sin registrar secretos ni alterar acceso', async () => {
  const logs = [];
  const app = express();
  app.use(observePublicDocuments({ log: (entry) => logs.push(entry) }));
  app.get('/politica-de-privacidad', (_req, res) =>
    res.send('Documento público'),
  );
  app.get('/robots.txt', (_req, res) =>
    res.type('text').send('User-agent: *\nAllow: /\n'),
  );
  app.get('/api/auth/facebook/callback', (_req, res) => res.sendStatus(400));

  const response = await request(app)
    .get('/politica-de-privacidad?token=secret-query')
    .set('User-Agent', 'facebookexternalhit/1.1')
    .set('Cookie', 'private=secret-cookie')
    .set('Authorization', 'Bearer secret-authorization')
    .expect(200);
  assert.match(response.headers['x-request-id'], /^[0-9a-f-]{36}$/);
  assert.equal(response.headers['set-cookie'], undefined);
  assert.equal(logs.length, 2);
  assert.equal(logs[0].phase, 'received');
  assert.equal(logs[1].phase, 'completed');
  assert.equal(logs[1].status, 200);
  assert.equal(logs[1].crawler, 'meta');
  assert.equal(logs[1].path, '/politica-de-privacidad');
  assert.equal(logs[1].requestId, response.headers['x-request-id']);
  assert.doesNotMatch(JSON.stringify(logs), /secret-|private=|Authorization/);

  await request(app)
    .head('/robots.txt')
    .set('User-Agent', 'Facebot')
    .expect(200);
  assert.equal(logs[3].method, 'HEAD');
  assert.equal(logs[3].crawler, 'meta');
  assert.equal(logs[3].status, 200);
  await request(app)
    .get('/api/auth/facebook/callback?code=secret-code')
    .expect(400);
  assert.equal(logs.length, 4);
});
