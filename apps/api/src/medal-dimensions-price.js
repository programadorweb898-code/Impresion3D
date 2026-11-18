// Supplied Medaile+čistá.3mf: XY planar bounds 250 x 200 mm, Z thickness 10 mm.
// Build transform scales all axes by 0.95; displayed height corresponds to mesh Y.
const correctionId = 'medal-dimensions-price-20261118';
export const medalMeasurementText =
  'Medidas: 23,75 cm de ancho × 19 cm de alto × 0,95 cm de espesor, según la escala del 95 % guardada en el archivo proporcionado.';

export async function migrateMedalDimensionsPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const product = await Product.findOne({
    _id: 'b158873faf5b03e11b540971',
    'source.id': '454689',
  }).lean();
  if (!product) return;
  const description = product.description?.includes(medalMeasurementText)
    ? product.description
    : [product.description?.trim(), medalMeasurementText].filter(Boolean).join(' ');
  const result = await Product.updateOne(
    { _id: product._id, __v: product.__v, description: product.description },
    {
      $set: {
        description,
        dimensions: { width: 237.5, height: 190, depth: 9.5 },
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
