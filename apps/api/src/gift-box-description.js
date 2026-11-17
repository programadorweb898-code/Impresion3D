const correctionId = 'gift-box-dimensions-price-20261117';
const productId = '457689d2e2a26c02a14d63c2';
const dimensionSentence = "La caja mide aproximadamente 11,6 cm de largo × 8,5 cm de ancho × 1,9 cm de profundidad, sin contar la tapa ni la perilla. ";

// One-time correction of the existing product; subsequent admin edits are kept.
export async function migrateGiftBoxDescription(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const product = await Product.findOne({ _id: productId, 'source.id': '74951' }).lean();
  if (!product) return;
  const result = await Product.updateOne(
    {
      _id: productId,
      'source.id': '74951',
      description: product.description,
      priceCents: product.priceCents,
      __v: product.__v ?? { $exists: false },
    },
    {
      $set: {
        description: (product.description || '').replace(dimensionSentence, ''),
        dimensions: { width: 116, height: 85, depth: 19 },
        priceCents: 500000,
      },
      $inc: { __v: 1 },
    },
  );
  // A concurrent administrator edit is retried on the next startup.
  if (result.matchedCount)
    await imports.updateOne(
      { _id: correctionId },
      { $setOnInsert: { completedAt: new Date() } },
      { upsert: true },
    );
}
