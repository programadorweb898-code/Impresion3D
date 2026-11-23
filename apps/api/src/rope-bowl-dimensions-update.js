// Full unscaled Bowl_003.3mf mesh, millimeters. Price is preserved.
const correctionId = 'rope-bowl-dimensions-20261123';
export async function migrateRopeBowlDimensions(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '3df31a88a4ae2f1f66c11f48', 'source.id': '13044' },
    { $set: { dimensions: { width: 202.86, height: 50.8, depth: 203.12 } }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
