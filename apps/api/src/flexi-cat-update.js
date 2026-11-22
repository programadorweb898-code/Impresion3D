// FlexiValentineCat (1).3mf, complete figure including heart and tail, mm.
const correctionId = 'flexi-cat-dimensions-price-20261122';
export async function migrateFlexiCat(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '3adf75a44416834d546b8aa8', 'source.id': '145302' },
    { $set: { dimensions: { width: 94.01, height: 8, depth: 37.06 }, priceCents: 200000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
