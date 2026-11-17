import catalog from './makerworld-catalog-20261117.json' with { type: 'json' };

// Match the original text so this correction runs once without overwriting
// later administrator edits, prices, images, or other products.
export async function migrateGiftBoxDescription(Product) {
  const box = catalog.find((product) => product._id === '457689d2e2a26c02a14d63c2');
  const dimensions = 'La caja mide aproximadamente 11,6 cm de largo × 8,5 cm de ancho × 1,9 cm de profundidad, sin contar la tapa ni la perilla. ';
  if (!box?.description.includes(dimensions))
    throw new Error('Falta la descripción verificada de la caja.');
  return Product.updateOne(
    {
      _id: box._id,
      'source.id': box.source.id,
      description: box.description.replace(dimensions, ''),
    },
    { $set: { description: box.description }, $inc: { __v: 1 } },
  );
}
