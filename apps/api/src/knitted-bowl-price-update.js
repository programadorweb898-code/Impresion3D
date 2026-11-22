const correctionId = 'knitted-bowl-price-20261122';
export async function migrateKnittedBowlPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '5afbb207db8cc4f6aa425532', 'source.id': '160651' },
    { $set: { priceCents: 700000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
