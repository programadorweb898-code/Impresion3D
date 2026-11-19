// Phone+Stand+2(2).3mf: object_29.model, Phone Stand No Charge v10.
// Mesh X = width, Y = depth, Z = height; print rotation does not change intended orientation.
const correctionId = 'compact-phone-dimensions-price-20261118';
export const phoneMeasurementText =
  'Medidas aproximadas: 7 cm de ancho, 8,12 cm de alto y 7,30 cm de profundidad.';

export async function migrateCompactPhone(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const product = await Product.findOne({
    _id: '96662806919bd26a60e00b30',
    'source.id': '692815',
  }).lean();
  if (!product) return;
  const description = product.description?.includes(phoneMeasurementText)
    ? product.description
    : [product.description?.trim(), phoneMeasurementText]
        .filter(Boolean)
        .join(' ');
  const result = await Product.updateOne(
    { _id: product._id, __v: product.__v, description: product.description },
    {
      $set: {
        description,
        dimensions: { width: 70, height: 81.23, depth: 73 },
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
