import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import { resolve } from 'node:path';
import { createApp } from '../apps/api/src/app.js';
import { User, Product, Order } from '../apps/api/src/models.js';
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
await Promise.all([User.init(), Order.init()]);
const user = await User.create({
  name: 'Cliente navegador',
  email: 'browser@example.com',
  passwordHash: await argon2.hash('browser-password-12345'),
});
const products = await Product.create(
  Array.from({ length: 25 }, (_, i) => ({
    name: 'Pieza ' + String(i).padStart(2, '0'),
    description: 'Producto de prueba',
    category: i === 0 ? 'Especial' : 'Hogar',
    color: 'sand',
    priceCents: 10050,
    dimensions: { width: 100, height: 100, depth: 100 },
    model: { url: 'https://res.cloudinary.com/test/model.glb', format: 'glb' },
  })),
);
await Order.create(
  Array.from({ length: 21 }, () => ({
    userId: user._id,
    items: [
      {
        productId: products[0]._id,
        name: 'Pedido previo',
        unitPriceCents: 10050,
        quantity: 1,
      },
    ],
    totalCents: 10050,
    currency: 'ARS',
    history: [],
  })),
);
const server = createApp({
  sessionSecret: 'browser-tests-isolated-secret-long-enough',
  webOrigin: 'http://127.0.0.1:3100',
  staticDirectory: resolve('apps/web/dist'),
}).listen(3100, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      await mongo.stop();
      process.exit(0);
    }),
  );
