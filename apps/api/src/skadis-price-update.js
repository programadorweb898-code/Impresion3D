const correctionId = 'skadis-price-20261122';
export async function migrateSkadisPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: 'd9030eb81cace95d35f2a668', 'source.id': '769733' },
    { $set: { priceCents: 280000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
