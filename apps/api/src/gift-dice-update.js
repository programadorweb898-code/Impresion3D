// Complete transformed assembly, Gift+Exchange+Dice+TWO+COLORS.3mf, mm.
const correctionId = 'gift-dice-dimensions-price-20261122';
export async function migrateGiftDice(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const result = await Product.updateOne(
    { _id: '19791ec820e9cf6017230469', 'source.id': '840834' },
    { $set: { dimensions: { width: 89.63, height: 76.22, depth: 94.19 }, priceCents: 1070000 }, $inc: { __v: 1 } },
  );
  if (result.matchedCount) await imports.updateOne(
    { _id: correctionId }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true },
  );
}
