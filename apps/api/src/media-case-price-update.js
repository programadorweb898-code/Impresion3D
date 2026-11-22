const correctionId = 'media-case-price-20261122';
export async function migrateMediaCasePrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: 'b191b9b6985fa7e45799ce06', 'source.id': '479663' },
    { $set: { priceCents: 500000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
