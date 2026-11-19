import records from './verified-dimensions-20261119.json' with { type: 'json' };

// Field-level updates preserve partial administrator measurements and all prices/photos.
export async function migrateVerifiedDimensions(Product) {
  const imports = Product.db.collection('catalogimports');
  for (const record of records) {
    const correctionId = `verified-dimensions-20261119:${record.id}`;
    if (await imports.findOne({ _id: correctionId })) continue;
    const product = await Product.findOne({
      _id: record.id,
      'source.id': record.sourceId,
    }).lean();
    if (!product) continue;
    const entries = Object.entries(record.dimensions);
    if (
      entries.some(
        ([key, value]) =>
          Number.isFinite(product.dimensions?.[key]) &&
          product.dimensions[key] !== value,
      )
    )
      continue;
    const missing = entries.filter(
      ([key]) => !Number.isFinite(product.dimensions?.[key]),
    );
    if (!missing.length) continue;
    const fields = Object.fromEntries(
      missing.map(([key, value]) => [`dimensions.${key}`, value]),
    );
    const result = await Product.updateOne(
      { _id: product._id, __v: product.__v },
      { $set: fields, $inc: { __v: 1 } },
    );
    if (result.matchedCount)
      await imports.updateOne(
        { _id: correctionId },
        {
          $setOnInsert: {
            completedAt: new Date(),
            sourceUrl: record.sourceUrl,
          },
        },
        { upsert: true },
      );
  }
}
