// Local pending correction; user confirmed commercial authorization on 2026-11-18.
// Supplied 3MF: X/Z footprint 150.987999 x 150.9906922 mm, Y height 20.5004998 mm.
const correctionId = 'shower-shelf-file-images-dimensions-20261118';
const fields = {
  priceCents: 500000,
  description:
    'Estante esquinero impreso en 3D con textura de piedra, base calada y bordes elevados. Su forma permite ordenar frascos y accesorios en una esquina del baño. Medidas aproximadas: 15,10 cm de ancho × 15,10 cm de profundidad × 2,05 cm de alto, tomadas del archivo proporcionado. No incluye frascos, accesorios ni fijaciones. Coordinamos la instalación y la compatibilidad con tu espacio. Diseño de Meșteșug Digital.',
  dimensions: {
    width: 150.99,
    height: 20.5,
    depth: 150.99,
  },
  image: {
    url: '/product-catalog/shower-stone-20261118-front.webp',
    width: 810,
    height: 1080,
  },
  gallery: {
    context: {
      url: '/product-catalog/shower-stone-20261118-context.webp',
      width: 810,
      height: 1080,
    },
  },
  imageNotice:
    'Fotografías incluidas en el archivo proporcionado. Los accesorios de ambientación no están incluidos.',
  source: {
    platform: 'Archivo 3MF',
    id: 'USf322bfb4e972c7',
    author: 'Meșteșug Digital',
    license: 'MakerWorld Exclusive License',
  },
};
export async function migrateShowerShelf(Product) {
  const imports = Product.db.collection('catalogimports');
  if (await imports.findOne({ _id: correctionId })) return;
  const product = await Product.findOne({
    _id: 'afe967a033dc7cd1d7fd2099',
    'source.id': '106945',
  }).lean();
  if (!product) return;
  const result = await Product.updateOne(
    { _id: product._id, __v: product.__v },
    { $set: fields, $inc: { __v: 1 } },
  );
  if (result.matchedCount)
    await imports.updateOne(
      { _id: correctionId },
      { $setOnInsert: { completedAt: new Date() } },
      { upsert: true },
    );
}
