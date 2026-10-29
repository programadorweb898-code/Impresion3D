import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { User, Product } from '../src/models.js';
import { normalizeImage, createImageStorage } from '../src/images.js';
let mongo, app, product, photo;
let uploads = 0,
  removals = [];
const origin = 'http://localhost:5173';
// Only the external Cloudinary boundary is replaced. MongoDB and image decoding are real.
const imageStorage = {
  async upload(buffer) {
    uploads++;
    const meta = await sharp(buffer).metadata();
    assert.equal(meta.format, 'webp');
    return {
      url:
        'https://res.cloudinary.com/test/image/upload/v1/impresion3d/products/test' +
        uploads +
        '.webp',
      publicId: 'impresion3d/products/test' + uploads,
      width: meta.width,
      height: meta.height,
    };
  },
  async remove(publicId) {
    removals.push(publicId);
  },
};
async function csrf(agent) {
  return (await agent.get('/api/csrf').expect(200)).body.token;
}
async function account(email, role = 'customer', application = app) {
  const agent = request.agent(application);
  const token = await csrf(agent);
  await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .set('x-csrf-token', token)
    .send({
      name: 'Foto prueba',
      email,
      password: 'clave-larga-para-la-prueba',
    })
    .expect(201);
  if (role === 'admin')
    await User.updateOne({ email }, { $set: { role: 'admin' } });
  return agent;
}
async function upload(
  agent,
  buffer,
  contentType = 'image/png',
  name = 'foto.png',
  extra = {},
) {
  const token = await csrf(agent);
  let r = agent
    .post('/api/admin/products/' + product._id + '/image')
    .set('Origin', origin)
    .set('x-csrf-token', token);
  for (const [k, v] of Object.entries(extra)) r = r.field(k, v);
  return r.attach('image', buffer, { filename: name, contentType });
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.init();
  product = await Product.create({ name: 'Maceta', priceCents: 1200000 });
  photo = await sharp({
    create: { width: 100, height: 80, channels: 3, background: '#c77855' },
  })
    .png()
    .toBuffer();
  app = createApp({
    sessionSecret: 'images-test-secret-with-at-least-32-characters',
    webOrigin: origin,
    imageStorage,
  });
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
test('sólo administradores con CSRF pueden subir fotos', async () => {
  await request(app)
    .post('/api/admin/products/' + product._id + '/image')
    .set('Origin', origin)
    .attach('image', photo, 'a.png')
    .expect(403);
  const guest = request.agent(app);
  await upload(guest, photo).then((r) => assert.equal(r.status, 401));
  const customer = await account('photo-customer@example.com');
  await upload(customer, photo).then((r) => assert.equal(r.status, 403));
  assert.equal(uploads, 0);
});
test('valida archivo, tamaño y campos antes de enviar a Cloudinary', async () => {
  const admin = await account('invalid-photo@example.com', 'admin');
  assert.equal(
    (await upload(admin, Buffer.from('no es una imagen'))).status,
    400,
  );
  assert.equal(
    (await upload(admin, Buffer.from('<svg></svg>'), 'image/svg+xml', 'a.svg'))
      .status,
    400,
  );
  assert.equal(
    (await upload(admin, Buffer.alloc(5 * 1024 * 1024 + 1))).status,
    400,
  );
  assert.equal(
    (await upload(admin, photo, 'image/png', 'a.png', { otro: 'campo' }))
      .status,
    400,
  );
  assert.equal(uploads, 0);
});
test('normaliza la imagen, guarda la referencia y reemplaza sin perder los datos del producto', async () => {
  const admin = await account('photo-admin@example.com', 'admin');
  const result = await upload(admin, photo);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.image.width, 100);
  const persisted = await Product.findById(product._id);
  assert.equal(persisted.image.publicId, 'impresion3d/products/test1');
  assert.equal(persisted.priceCents, 1200000);
  const catalog = await request(app).get('/api/products').expect(200);
  assert.equal(catalog.body[0].image.url, result.body.image.url);
  assert.equal((await upload(admin, photo)).status, 200);
  assert.deepEqual(removals, ['impresion3d/products/test1']);
});
test('sin credenciales o ante fallos externos, la foto anterior se conserva', async () => {
  const previous = (await Product.findById(product._id)).image.url;
  const noCloud = createApp({
    sessionSecret: 'no-cloud-secret-with-at-least-32-characters',
    webOrigin: origin,
  });
  const admin = await account('no-cloud@example.com', 'admin', noCloud);
  assert.equal((await upload(admin, photo)).status, 503);
  const failing = createApp({
    sessionSecret: 'failing-cloud-secret-at-least-32-characters',
    webOrigin: origin,
    imageStorage: {
      upload: async () => {
        throw new Error('external failure');
      },
    },
  });
  const another = await account('failing-cloud@example.com', 'admin', failing);
  assert.equal((await upload(another, photo)).status, 502);
  assert.equal((await Product.findById(product._id)).image.url, previous);
});
test('convierte fotos grandes y rechaza configuraciones incompletas', async () => {
  const big = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: 'white' },
  })
    .jpeg()
    .toBuffer();
  const image = await normalizeImage(big);
  assert.equal(image.width, 1600);
  assert.equal(image.height, 800);
  assert.equal(createImageStorage({}), null);
  assert.throws(
    () => createImageStorage({ cloudName: 'demo' }),
    /tres variables/,
  );
});
