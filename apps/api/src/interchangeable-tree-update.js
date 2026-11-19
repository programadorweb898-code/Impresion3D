// Supplied lattice-tree+fff.3mf, spiral-tree.stl, object_4.model.
// Crown only: X 79.2, Y 79.1851, Z 98.5 mm. Separate trunks excluded.
const correctionId = 'interchangeable-tree-dimensions-price-20261118';
export const treeMeasurementText =
  'Medidas de la copa espiral: aproximadamente 7,92 cm de diámetro y 9,85 cm de alto, sin contar el tronco roscado.';

export async function migrateInterchangeableTree(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const product = await Product.findOne({
    _id: 'aa541933f3162551c2b3378e',
    'source.id': '55275',
  }).lean();
  if (!product) return;
  const description = product.description?.includes(treeMeasurementText)
    ? product.description
    : [product.description?.trim(), treeMeasurementText]
        .filter(Boolean)
        .join(' ');
  const result = await Product.updateOne(
    { _id: product._id, __v: product.__v, description: product.description },
    {
      $set: {
        description,
        dimensions: { width: 79.2, height: 98.5, depth: 79.19 },
        priceCents: 500000,
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
