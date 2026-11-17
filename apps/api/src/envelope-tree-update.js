// Envelope folded size: 165 x 80 mm, stated in the supplied 3MF metadata.
// Folded thickness is not specified; no depth is invented.
const corrections = [
  {
    id: 'envelope-folded-dimensions-price-20261117',
    productId: 'dfa1353cef54ee23ef970b72',
    sourceId: '1486060',
    fields: { dimensions: { width: 165, height: 80 }, priceCents: 200000 },
  },
  {
    id: 'ribbed-led-tree-price-15000-20261117',
    productId: '8bc55557a9a2a859d561e53b',
    sourceId: '1998883',
    fields: { priceCents: 1500000 },
  },
];
export async function migrateEnvelopeAndTreePrices(Product) {
  const imports = Product.db.collection('catalogimports');
  for (const correction of corrections) {
    if (await imports.findOne({ _id: correction.id })) continue;
    const result = await Product.updateOne(
      { _id: correction.productId, 'source.id': correction.sourceId },
      { $set: correction.fields, $inc: { __v: 1 } },
    );
    if (result.matchedCount)
      await imports.updateOne(
        { _id: correction.id },
        { $setOnInsert: { completedAt: new Date() } },
        { upsert: true },
      );
  }
}
