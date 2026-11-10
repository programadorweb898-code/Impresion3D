import { Product } from './models.js';

// Existing products can be featured in multiple sections without duplicating records.
const pumpkinId = '6ae3b624b8011b76f2019acd';
const mayersId = '6ae4d6f4fdc56973a99397e6';

export async function migrateSeasonalCuencos() {
  await Product.updateMany(
    { _id: { $in: [pumpkinId, mayersId] } },
    { $addToSet: { categories: { $each: ['Halloween', 'Cuencos'] } } },
  );
  // Rename only the original horror-themed label, never later admin edits.
  await Product.updateOne(
    {
      _id: mayersId,
      name: { $ne: 'Cuenco de Mayers', $regex: /jason|mayers|myers/i },
    },
    { $set: { name: 'Cuenco de Mayers' } },
  );
}
