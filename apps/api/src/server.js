import { migrateHalloweenLanternPrice } from './halloween-lantern-price-update.js';
import { migrateGiftDice } from './gift-dice-update.js';
import { migrateToothbrushCasePrice } from './toothbrush-case-price-update.js';
import { migrateRopeBowlPrice } from './rope-bowl-price-update.js';
import { migrateAdjustablePhonePrice } from './adjustable-phone-price-update.js';
import { migrateKnittedBowlPrice } from './knitted-bowl-price-update.js';
import { migrateMediaCasePrice } from './media-case-price-update.js';
import { migrateHeartPhotoPrice } from './heart-photo-price-update.js';
import { migrateSkadisPrice } from './skadis-price-update.js';
import { migrateNameTagPrice } from './name-tag-price-update.js';
import { migrateFlexiCat } from './flexi-cat-update.js';
import { migrateMinimalPhone } from './minimal-phone-update.js';
import { migrateClickerPrice } from './clicker-price-update.js';
import { migrateHydroPrice } from './hydro-price-update.js';
import { migrateDoorHook } from './door-hook-update.js';
import {
  Product,
  Order,
  DesignRequest,
  PhotoQuote,
  SlicerWorker,
  SlicingJob,
  ShippingUsage,
} from './models.js';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import MongoStore from 'connect-mongo';
import { z } from 'zod';
import { createApp } from './app.js';
import { createImageStorage } from './images.js';
import { createAccountServices } from './account-access.js';
import { SocialIdentity } from './models.js';
import { ensureUserEmailIndex } from './user-email-index.js';
import { migrateCatalogCopy } from './catalog-copy.js';
import { migrateChristmasCatalog } from './christmas-catalog.js';
import { migrateMakerworldCatalog } from './makerworld-catalog.js';
import { migrateGiftBoxDescription } from './gift-box-description.js';
import { migrateLedTreeDimensions } from './led-tree-dimensions.js';
import { migrateEnvelopeAndTreePrices } from './envelope-tree-update.js';
import { migrateWovenPencilHolder } from './woven-pencil-holder-update.js';
import { migrateB3Price } from './b3-price-update.js';
import { migrateWovenCoaster } from './woven-coaster-update.js';
import { migrateB3Dimensions } from './b3-dimensions-update.js';
import { migrateCactusDimensionsPrice } from './cactus-dimensions-price.js';
import { migrateMedalDimensionsPrice } from './medal-dimensions-price.js';
import { migrateShowerShelf } from './shower-shelf-update.js';
import { migrateInterchangeableTree } from './interchangeable-tree-update.js';
import { migratePawDimensionsPrice } from './paw-dimensions-price.js';
import { migrateCompactPhone } from './compact-phone-update.js';
import { migrateVerifiedDimensions } from './verified-dimensions-update.js';
import { migrateSeasonalCuencos } from './seasonal-cuencos.js';
import {
  createOrderNotifier,
  startOrderNotifications,
} from './order-notifications.js';
const env = z
  .object({
    MONGODB_URI: z.string().min(1),
    CLOUDINARY_CLOUD_NAME: z.string().trim().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().trim().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().trim().min(1).optional(),
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
const imageStorage = createImageStorage({
  cloudName: env.CLOUDINARY_CLOUD_NAME,
  apiKey: env.CLOUDINARY_API_KEY,
  apiSecret: env.CLOUDINARY_API_SECRET,
});
const accountServices = createAccountServices(process.env);
const notifyOrder = createOrderNotifier(process.env);
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
await Promise.all([
  ensureUserEmailIndex(),
  Product.init(),
  Order.init(),
  SocialIdentity.init(),
  DesignRequest.init(),
  PhotoQuote.init(),
  SlicerWorker.init(),
  SlicingJob.init(),
  ShippingUsage.init(),
]);
console.info(JSON.stringify({ event: 'database_indexes_ready' }));
await migrateCatalogCopy();
await migrateSeasonalCuencos();
await migrateMakerworldCatalog();
await migrateChristmasCatalog();
await migrateGiftBoxDescription(Product);
await migrateLedTreeDimensions(Product);
await migrateEnvelopeAndTreePrices(Product);
await migrateWovenPencilHolder(Product);
await migrateB3Price(Product);
await migrateB3Dimensions(Product);
await migrateCactusDimensionsPrice(Product);
await migrateMedalDimensionsPrice(Product);
await migrateShowerShelf(Product);
await migrateInterchangeableTree(Product);
await migratePawDimensionsPrice(Product);
await migrateCompactPhone(Product);
await migrateVerifiedDimensions(Product);
await migrateWovenCoaster(Product);
await migrateDoorHook(Product);
await migrateHydroPrice(Product);
await migrateClickerPrice(Product);
await migrateMinimalPhone(Product);
await migrateFlexiCat(Product);
await migrateNameTagPrice(Product);
await migrateSkadisPrice(Product);
await migrateHeartPhotoPrice(Product);
await migrateMediaCasePrice(Product);
await migrateKnittedBowlPrice(Product);
await migrateAdjustablePhonePrice(Product);
await migrateRopeBowlPrice(Product);
await migrateToothbrushCasePrice(Product);
await migrateGiftDice(Product);
await migrateHalloweenLanternPrice(Product);
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
  imageStorage,
  accountServices,
  notifyOrder,
  buildCommit: process.env.RENDER_GIT_COMMIT,
  production: env.NODE_ENV === 'production',
  trustProxy: env.TRUST_PROXY === '1',
});
const server = app.listen(env.PORT, '0.0.0.0', () =>
  console.log(`API disponible en puerto ${env.PORT}`),
);
const stopNotifications = startOrderNotifications(notifyOrder);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      stopNotifications();
      await mongoose.disconnect();
      process.exit(0);
    }),
  );
