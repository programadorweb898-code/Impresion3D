const correctionId = 'christmas-lantern-price-20261122';
export async function migrateChristmasLanternPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '1c1fdbd045b9b282fc765c95', 'source.id': '746218' },
    { $set: { priceCents: 2200000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
