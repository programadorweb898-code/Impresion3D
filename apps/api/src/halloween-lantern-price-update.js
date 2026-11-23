const correctionId = 'halloween-lantern-price-20261122';
export async function migrateHalloweenLanternPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '56fbf8f421832767073b5726', 'source.id': '633095' },
    { $set: { priceCents: 2500000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
