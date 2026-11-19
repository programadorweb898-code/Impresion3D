// User explicitly confirmed these measurements also apply to the retained snowflake design.
// Source file differs visually; current photos, design and attribution are preserved.
const correctionId = 'paw-user-confirmed-dimensions-price-20261118';
export const pawMeasurementText =
  'Medidas aproximadas: 7,12 cm de ancho, 8,11 cm de alto y 0,50 cm de espesor, incluyendo el aro y los relieves.';

export async function migratePawDimensionsPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const product = await Product.findOne({
    _id: '9fa5cd6ffc6c88fcbd9f2468',
    'source.id': '806001',
  }).lean();
  if (!product) return;
  const description = product.description?.includes(pawMeasurementText)
    ? product.description
    : [product.description?.trim(), pawMeasurementText]
        .filter(Boolean)
        .join(' ');
  const result = await Product.updateOne(
    { _id: product._id, __v: product.__v, description: product.description },
    {
      $set: {
        description,
        dimensions: { width: 71.18, height: 81.11, depth: 4.96 },
        priceCents: 300000,
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
