const correctionId = 'name-tag-price-20261122';
export async function migrateNameTagPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '03157f1c68423e396b1dd793', 'source.id': '2868843' },
    { $set: { priceCents: 200000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
