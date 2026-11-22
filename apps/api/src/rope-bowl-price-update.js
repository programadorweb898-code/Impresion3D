const correctionId = 'rope-bowl-price-20261122';
export async function migrateRopeBowlPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '3df31a88a4ae2f1f66c11f48', 'source.id': '13044' },
    { $set: { priceCents: 1000000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
