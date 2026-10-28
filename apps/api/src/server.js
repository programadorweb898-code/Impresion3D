import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { z } from 'zod';
import { createApp } from './app.js';
const env = z
  .object({
    MONGODB_URI: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    WEB_ORIGIN: z.url(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    TRUST_PROXY: z.enum(['0', '1']).default('0'),
  })
  .parse(process.env);
await mongoose.connect(env.MONGODB_URI);
const store = MongoStore.create({
  client: mongoose.connection.getClient(),
  dbName: mongoose.connection.name,
  collectionName: 'sessions',
});
const app = createApp({
  sessionStore: store,
  sessionSecret: env.SESSION_SECRET,
  webOrigin: env.WEB_ORIGIN,
  production: env.NODE_ENV === 'production',
  trustProxy: env.TRUST_PROXY === '1',
});
const server = app.listen(env.PORT, () =>
  console.log(`API disponible en puerto ${env.PORT}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }),
  );
