const correctionId = 'haunted-house-price-20261122';
export async function migrateHauntedHousePrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '80c9b4319ac2dcdab7580350', 'source.id': '35259' },
    { $set: { priceCents: 1200000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
