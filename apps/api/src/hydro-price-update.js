const correctionId = 'hydro-price-20261122';
export async function migrateHydroPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '5e4bcd314357caa6629505a7', 'source.id': '1526699' },
    { $set: { priceCents: 17000000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
