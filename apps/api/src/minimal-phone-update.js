// Phone+Stand+Updated (1).3mf; dimensions in mm, oriented for use.
const correctionId = 'minimal-phone-dimensions-price-20261122';
export async function migrateMinimalPhone(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '50c969d4dbfb60bfba085a96', 'source.id': '2320874' },
    { $set: { dimensions: { width: 54.01, height: 90.47, depth: 62.41 }, priceCents: 300000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
