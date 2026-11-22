const correctionId = 'toothbrush-case-price-20261122';
export async function migrateToothbrushCasePrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '26244f7e4f16ab7bc3bf5ad9', 'source.id': '13128' },
    { $set: { priceCents: 170000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
