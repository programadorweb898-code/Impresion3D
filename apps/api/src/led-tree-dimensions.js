const correctionId = 'ribbed-led-tree-dimensions-20261117';
export async function migrateLedTreeDimensions(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '8bc55557a9a2a859d561e53b', 'source.id': '1998883' },
    {
      $set: { dimensions: { width: 65.4, height: 85, depth: 66.6 } },
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
