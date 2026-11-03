import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import express from 'express';
import { resolve } from 'node:path';
import { createApp } from '../apps/api/src/app.js';
import {
  User,
  Product,
  Order,
  SocialIdentity,
} from '../apps/api/src/models.js';
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
await Promise.all([User.init(), Order.init(), SocialIdentity.init()]);
const user = await User.create({
  name: 'Cliente navegador',
  email: 'browser@example.com',
  passwordHash: await argon2.hash('browser-password-12345'),
});
await User.create({
  name: 'Admin navegador',
  email: 'admin-browser@example.com',
  role: 'admin',
  passwordHash: await argon2.hash('browser-password-12345'),
});
const products = await Product.create(
  Array.from({ length: 25 }, (_, i) => ({
    name: 'Pieza ' + String(i).padStart(2, '0'),
    description:
      'Producto de prueba\nDescripción completa conservada en la ficha.',
    ...(i === 0
      ? {
          image: {
            url: '/images/hero-3d-studio.svg',
            width: 1000,
            height: 1000,
          },
        }
      : {}),
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
// The mailbox exists only in this isolated test server; it is never part of the production app.
const mailbox = new Map();
const host = express();
host.get('/__test/mailbox/:email', (req, res) =>
  res.json(mailbox.get(req.params.email) || null),
);
host.use(
  createApp({
    sessionSecret: 'browser-tests-isolated-secret-long-enough',
    webOrigin: 'http://127.0.0.1:3100',
    // Synthetic per-test client IPs isolate the real production rate limiter.
    // This server binds localhost and is never deployed.
    trustProxy: true,
    staticDirectory: resolve('apps/web/dist'),
    accountServices: {
      providers: {
        facebook: {
          clientId: 'browser-test-id',
          clientSecret: 'browser-test-secret',
        },
      },
      facebookVersion: 'v26.0',
      // Only the isolated test server substitutes the provider. Production always calls Graph.
      fetch: async (url) => ({
        ok: true,
        json: async () =>
          url.includes('/oauth/access_token')
            ? { access_token: 'browser-test-token' }
            : {
                id: 'facebook-browser-no-email',
                name: 'Cliente Facebook navegador',
              },
      }),
      sendVerification: async (message) => mailbox.set(message.email, message),
      sendEmailChange: async (message) => mailbox.set(message.email, message),
    },
  }),
);
const server = host.listen(3100, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      await mongo.stop();
      process.exit(0);
    }),
  );
