import { readFile } from 'node:fs/promises';
import catalog from './catalog-preview-20261127.json' with { type: 'json' };
import { Product } from './models.js';

const importId = 'catalog-preview-20261127';
const normalizeName = (name) =>
  name.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase();

export async function importCatalogPreviews(imageStorage) {
  await importInitialCatalogPreviews(imageStorage);
  await updateBaptismPhoto(imageStorage);
}

async function importInitialCatalogPreviews(imageStorage) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: importId })) return;

  const existing = await Product.find({}, '_id name').lean();
  const ids = new Set(existing.map(({ _id }) => String(_id)));
  const names = new Set(existing.map(({ name }) => normalizeName(name)));
  const additions = catalog.filter(
    ({ _id, name }) => !ids.has(_id) && !names.has(normalizeName(name)),
  );

  for (let offset = 0; offset < additions.length; offset += 4) {
    await Promise.all(
      additions.slice(offset, offset + 4).map(async ({ _id, ...product }) => {
        const [image, context] = await Promise.all(
          ['front', 'context'].map(async (view) => {
            const file = new URL(
              `./catalog-preview-images/${_id}-${view}.webp`,
              import.meta.url,
            );
            return imageStorage.upload(await readFile(file), {
              publicId: `impresion3d/products/${_id}-${view}`,
            });
          }),
        );
        await Product.updateOne(
          { _id },
          { $setOnInsert: { ...product, image, gallery: { context } } },
          { upsert: true },
        );
      }),
    );
  }
  await imports.updateOne(
    { _id: importId },
    { $setOnInsert: { completedAt: new Date() } },
    { upsert: true },
  );
}

async function updateBaptismPhoto(imageStorage) {
  const _id = 'ae879ef4b5c4a4d65edfb971';
  const imports = Product.db.collection('catalogimports');
  const changeId = 'baptism-context-v2-20261127';
  if (await imports.findOne({ _id: changeId })) return;
  const filter = {
    _id,
    'gallery.context.publicId': `impresion3d/products/${_id}-context`,
  };
  if (await Product.exists(filter)) {
    const filename = `${_id}-baptism-context-v2`;
    const file = new URL(`./catalog-preview-images/${filename}.webp`, import.meta.url);
    const image = await imageStorage.upload(await readFile(file), {
      publicId: `impresion3d/products/${filename}`,
    });
    await Product.updateOne(filter, { $set: { 'gallery.context': image } });
  }
  await imports.updateOne(
    { _id: changeId },
    { $setOnInsert: { completedAt: new Date() } },
    { upsert: true },
  );
}
