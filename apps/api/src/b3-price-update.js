const correctionId = 'b3-led-price-35000-20261117';
export async function migrateB3Price(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: 'db45540315356c8de0695673', 'source.id': '50252' },
    { $set: { priceCents: 3500000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount)
    await imports.updateOne(
      { _id: correctionId },
      { $setOnInsert: { completedAt: new Date() } },
      { upsert: true },
    );
}
