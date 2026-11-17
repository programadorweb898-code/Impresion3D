// External bounds of the supplied portalapices_tejido.3mf, in millimeters.
const correctionId = 'woven-pencil-holder-dimensions-price-20261117';
export async function migrateWovenPencilHolder(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: 'db589da55bcdc99e2954092b', 'source.id': '13122' },
    {
      $set: {
        dimensions: { width: 88.27, height: 95.36, depth: 88.99 },
        priceCents: 800000,
      },
      $inc: { __v: 1 },
    },
  );
  if (result.matchedCount)
    await imports.updateOne(
      { _id: correctionId },
      { $setOnInsert: { completedAt: new Date() } },
      { upsert: true },
    );
}
