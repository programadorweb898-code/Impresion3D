// Body mesh (object 10), Three+body+problem.3mf, user-confirmed for this listing.
// Includes the screen only, not the separately printed auxiliary bases.
const correctionId = 'b3-confirmed-screen-dimensions-20261117';
export async function migrateB3Dimensions(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: 'db45540315356c8de0695673', 'source.id': '50252' },
    {
      $set: { dimensions: { width: 137.15, height: 247.99, depth: 146.45 } },
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
