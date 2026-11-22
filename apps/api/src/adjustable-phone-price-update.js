const correctionId = 'adjustable-phone-price-20261122';
export async function migrateAdjustablePhonePrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '4fa6546bbd75e09a90e0cd83', 'source.id': '914894' },
    { $set: { priceCents: 500000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
