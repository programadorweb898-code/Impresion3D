import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { validateProductModel } from '../src/product-models.js';
import { createApp } from '../src/app.js';
import { User, Product } from '../src/models.js';
import { tetraStl, tetraGlb } from './helpers/model-fixtures.js';
import { coloredThreeMf } from './helpers/three-mf-fixtures.js';
let mongo, app, product;
let uploads = 0;
const removed = [];
const origin = 'http://localhost:5173';
const storage = {
  async uploadModel(buffer, format) {
    uploads++;
    return {
      url: `https://res.cloudinary.com/test/raw/upload/v1/impresion3d/models/${uploads}.${format}`,
      publicId: `impresion3d/models/${uploads}.${format}`,
      format,
      bytes: buffer.length,
    };
  },
  async removeModel(id) {
    removed.push(id);
  },
};
async function token(agent) {
  return (await agent.get('/api/csrf')).body.token;
}
async function account(email, admin = false) {
  const agent = request.agent(app);
  const csrf = await token(agent);
  await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .send({
      name: 'Modelo prueba',
      email,
      password: 'clave-larga-para-la-prueba',
    })
    .expect(201);
  if (admin) await User.updateOne({ email }, { $set: { role: 'admin' } });
  return agent;
}
async function upload(agent, buffer, name = 'model.stl') {
  const csrf = await token(agent);
  return agent
    .post(`/api/admin/products/${product._id}/model`)
    .set('Origin', origin)
    .set('x-csrf-token', csrf)
    .attach('model', buffer, {
      filename: name,
      contentType: 'application/octet-stream',
    });
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.init();
  product = await Product.create({
    name: 'Producto prueba',
    priceCents: 100,
    image: { url: 'https://res.cloudinary.com/test/photo.webp' },
  });
  app = createApp({
    sessionSecret: 'models-test-secret-with-at-least-32-characters',
    webOrigin: origin,
    imageStorage: storage,
  });
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
test('valida geometría real de STL y GLB y bloquea recursos externos', async () => {
  assert.equal(
    (
      await validateProductModel({
        buffer: tetraStl(),
        originalname: 'model.stl',
      })
    ).format,
    'stl',
  );
  assert.equal(
    (
      await validateProductModel({
        buffer: tetraGlb(),
        originalname: 'model.glb',
      })
    ).format,
    'glb',
  );
  await assert.rejects(
    () =>
      validateProductModel({
        buffer: Buffer.from('not a model'),
        originalname: 'model.glb',
      }),
    /no es válido/,
  );
  await assert.rejects(
    () =>
      validateProductModel({
        buffer: tetraGlb((doc) => {
          doc.buffers[0].uri = 'https://external.example/model.bin';
          return doc;
        }),
        originalname: 'external.glb',
      }),
    /sin URLs/,
  );
  await assert.rejects(
    () =>
      validateProductModel({
        buffer: tetraGlb((doc) => {
          doc.extensionsUsed = ['KHR_draco_mesh_compression'];
          return doc;
        }),
        originalname: 'compressed.glb',
      }),
    /sin compresión/,
  );
  await assert.rejects(
    () =>
      validateProductModel({
        buffer: tetraGlb((doc) => {
          doc.meshes = { invalid: true };
          return doc;
        }),
        originalname: 'invalid.glb',
      }),
    /estructura inválida/,
  );
  const corrupt = tetraStl();
  corrupt.writeFloatLE(NaN, 96);
  await assert.rejects(
    () => validateProductModel({ buffer: corrupt, originalname: 'bad.stl' }),
    /coordenadas/,
  );
});
test('sólo el administrador con CSRF puede cargar modelos', async () => {
  const guest = request.agent(app);
  assert.equal((await upload(guest, tetraStl())).status, 401);
  const customer = await account('model-customer@example.com');
  assert.equal((await upload(customer, tetraStl())).status, 403);
  assert.equal(uploads, 0);
  await request(app)
    .post(`/api/admin/products/${product._id}/model`)
    .set('Origin', origin)
    .attach('model', tetraStl(), 'model.stl')
    .expect(403);
});
test('publica y reemplaza un modelo; conserva la foto y rechaza archivos inválidos', async () => {
  const admin = await account('model-admin@example.com', true);
  const first = await upload(admin, tetraStl());
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.model.format, 'stl');
  const catalog = await request(app).get('/api/products');
  assert.equal(catalog.body[0].model.format, 'stl');
  assert.equal(
    catalog.body[0].image.url,
    'https://res.cloudinary.com/test/photo.webp',
  );
  const next = await upload(admin, tetraGlb(), 'model.glb');
  assert.equal(next.status, 200, JSON.stringify(next.body));
  assert.deepEqual(removed, ['impresion3d/models/1.stl']);
  assert.equal(
    (await upload(admin, Buffer.from('<script>'), 'model.glb')).status,
    400,
  );
  assert.equal(uploads, 2);
  assert.equal((await Product.findById(product._id)).model.format, 'glb');
  assert.equal(
    (await upload(admin, Buffer.alloc(10 * 1024 * 1024 + 1), 'large.stl'))
      .status,
    400,
  );
});

test('la carga administrativa de 3MF guarda GLB y conserva origen y foto', async () => {
  const admin = await account('mf-admin@example.com', true);
  const response = await upload(admin, coloredThreeMf(), 'keychains.3mf');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.model.format, 'glb');
  assert.equal(response.body.model.sourceFormat, '3mf');
  const current = await Product.findById(product._id);
  assert.equal(current.model.sourceFormat, '3mf');
  assert.equal(current.image.url, 'https://res.cloudinary.com/test/photo.webp');
});
