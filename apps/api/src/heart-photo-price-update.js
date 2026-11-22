const correctionId = 'heart-photo-price-20261122';
export async function migrateHeartPhotoPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: 'd62fde842fa0e95488ce77ca', 'source.id': '2280729' },
    { $set: { priceCents: 200000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
