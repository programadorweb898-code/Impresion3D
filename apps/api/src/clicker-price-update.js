const correctionId = 'clicker-price-20261122';
export async function migrateClickerPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '512a1cf568dd0eb17190b83e', 'source.id': '3330650' },
    { $set: { priceCents: 350000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
