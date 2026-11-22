// Single coaster measured from Woven+Coasters+and+Holder.3mf; excludes holder.
const correctionId = 'woven-coaster-dimensions-price-20261122';
export async function migrateWovenCoaster(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '74798b86c0a21421109dbb33', 'source.id': '13127' },
    { $set: { dimensions: { width: 98.13, height: 6.6, depth: 98.13 }, priceCents: 300000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount)
    await imports.updateOne(
      { _id: correctionId },
      { $setOnInsert: { completedAt: new Date() } },
      { upsert: true },
    );
}
