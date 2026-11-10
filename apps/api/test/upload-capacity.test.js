import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createUploadCapacity } from '../src/upload-capacity.js';
test(
  'limita archivos simultáneos y subidas del mismo usuario; libera capacidad al terminar',
  { timeout: 10000 },
  async () => {
    const app = express();
    const pending = [];
    app.post(
      '/',
      (req, res, next) => {
        req.user = { _id: req.get('user') };
        next();
      },
      createUploadCapacity(2),
      (req, res) => pending.push(res),
    );
    const one = request(app)
      .post('/')
      .set('user', 'a')
      .then((r) => r);
    while (pending.length < 1) await new Promise((r) => setTimeout(r, 5));
    await request(app)
      .post('/')
      .set('user', 'a')
      .expect(429)
      .expect('Retry-After', '5');
    const two = request(app)
      .post('/')
      .set('user', 'b')
      .then((r) => r);
    while (pending.length < 2) await new Promise((r) => setTimeout(r, 5));
    const rejected = await request(app).post('/').set('user', 'c').expect(429);
    assert.match(rejected.body.message, /Esperá/);
    pending[0].sendStatus(204);
    pending[1].sendStatus(204);
    await Promise.all([one, two]);
    const again = request(app)
      .post('/')
      .set('user', 'a')
      .then((r) => r);
    while (pending.length < 3) await new Promise((r) => setTimeout(r, 5));
    pending[2].sendStatus(204);
    assert.equal((await again).status, 204);
  },
);
