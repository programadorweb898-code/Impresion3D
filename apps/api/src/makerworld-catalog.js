import catalog from './makerworld-catalog-20261117.json' with { type: 'json' };
import printablesCatalog from './printables-catalog-20261127.json' with { type: 'json' };
import { Product } from './models.js';

export const makerworldImportId = 'makerworld-catalog-20261117';
const normalize = (name) =>
  name.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase();

// A completed import never runs again: edits, hidden items and later deletions
// remain under administrator control. Stable IDs also make partial retries safe.
export function migrateMakerworldCatalog() {
  return importCatalog(makerworldImportId, catalog);
}

export function migratePrintablesCatalog() {
  return importCatalog('printables-catalog-20261127', printablesCatalog);
}

async function importCatalog(importId, catalog) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: importId })) return;
  const existing = await Product.find({}, 'name source.id').lean();
  const names = new Set(existing.map((p) => normalize(p.name)));
  const sources = new Set(existing.map((p) => p.source?.id).filter(Boolean));
  const additions = catalog.filter(
    (p) => !names.has(normalize(p.name)) && !sources.has(p.source.id),
  );
  if (additions.length) {
    await Product.bulkWrite(
      additions.map(({ _id, ...product }) => ({
        updateOne: {
          filter: { _id },
          update: {
            $setOnInsert: {
              ...product,
              __v: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          upsert: true,
          timestamps: false,
        },
      })),
    );
  }
  await imports.updateOne(
    { _id: importId },
    {
      $setOnInsert: { completedAt: new Date(), sourceCount: catalog.length },
    },
    { upsert: true },
  );
}
