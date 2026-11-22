// door_hanger.3mf, whole hook in its installed orientation, in mm.
const correctionId = 'door-hook-dimensions-price-20261122';
export async function migrateDoorHook(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '62664d92a866feec2bbac075', 'source.id': '196347' },
    { $set: { dimensions: { width: 25, height: 62, depth: 59.6 }, priceCents: 100000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount)
    await imports.updateOne(
      { _id: correctionId },
      { $setOnInsert: { completedAt: new Date() } },
      { upsert: true },
    );
}
