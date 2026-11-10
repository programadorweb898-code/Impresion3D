import copy from './catalog-copy-20261107.json' with { type: 'json' };
import { Product } from './models.js';

// Only update the reviewed originals: later administrator edits are never replaced.
export async function migrateCatalogCopy() {
  return Product.bulkWrite(
    copy.map(({ id, previousDescription, ...fields }) => ({
      updateOne: {
        filter: {
          _id: id,
          description: previousDescription,
          $or: [
            { shortDescription: { $exists: false } },
            { shortDescription: '' },
          ],
        },
        update: { $set: fields, $inc: { __v: 1 } },
      },
    })),
  );
}
