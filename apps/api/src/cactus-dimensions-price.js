// Spiral body: object 1 in 3D/Objects/object_9.model, macetas+cactus.3mf.
// Body bounds are 66.3523712 x 66.3523712 x 55 mm; limbs are excluded.
const correctionId = 'cactus-body-dimensions-price-20261118';
export const cactusMeasurementText =
  'Medidas del cuerpo de la maceta: 6,64 cm de diámetro y 5,5 cm de alto, sin contar brazos ni piernas articuladas.';

export async function migrateCactusDimensionsPrice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const product = await Product.findOne({
    _id: 'ba3d15e5646ef11acd95e93f',
    'source.id': '1423054',
  }).lean();
  if (!product) return;
  const description = product.description?.includes(cactusMeasurementText)
    ? product.description
    : [product.description?.trim(), cactusMeasurementText].filter(Boolean).join(' ');
  const result = await Product.updateOne(
    { _id: product._id, __v: product.__v, description: product.description },
    {
      $set: {
        description,
        dimensions: { width: 66.35, height: 55, depth: 66.35 },
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
