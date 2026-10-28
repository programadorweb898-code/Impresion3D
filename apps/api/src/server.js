import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import MongoStore from 'connect-mongo';
import { z } from 'zod';
import { createApp } from './app.js';
const env = z
  .object({
    MONGODB_URI: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    WEB_ORIGIN: z.url().optional(),
    RENDER_EXTERNAL_URL: z.url().optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    TRUST_PROXY: z.enum(['0', '1']).default('0'),
  })
  .parse(process.env);
const originValue = env.WEB_ORIGIN || env.RENDER_EXTERNAL_URL;
if (!originValue) throw new Error('Configurá WEB_ORIGIN');
const webOrigin = new URL(originValue).origin;
if (env.NODE_ENV === 'production' && !webOrigin.startsWith('https://'))
  throw new Error('Producción requiere un origen HTTPS');
const staticDirectory =
  env.NODE_ENV === 'production'
    ? fileURLToPath(new URL('../../web/dist/', import.meta.url))
    : undefined;
if (staticDirectory && !existsSync(staticDirectory + 'index.html'))
  throw new Error('Primero ejecutá npm run build');
await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const store = MongoStore.create({
  client: mongoose.connection.getClient(),
  dbName: mongoose.connection.name,
  collectionName: 'sessions',
});
const app = createApp({
  sessionStore: store,
  sessionSecret: env.SESSION_SECRET,
  webOrigin,
  staticDirectory,
  production: env.NODE_ENV === 'production',
  trustProxy: env.TRUST_PROXY === '1',
});
const server = app.listen(env.PORT, '0.0.0.0', () =>
  console.log(`API disponible en puerto ${env.PORT}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }),
  );
