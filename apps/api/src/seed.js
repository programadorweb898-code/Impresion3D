import mongoose from 'mongoose';
import { Product } from './models.js';
if (!process.env.MONGODB_URI) throw new Error('Configurá MONGODB_URI');
await mongoose.connect(process.env.MONGODB_URI);
const demos = [
  {
    name: 'Maceta Origami',
    category: 'Hogar',
    description: 'Una pieza geométrica para darle vida a tu escritorio.',
    color: 'terracotta',
    priceCents: 1200000,
    dimensions: { width: 120, height: 110, depth: 120 },
  },
  {
    name: 'Organizador Modular',
    category: 'Organización',
    description: 'Todo en su lugar, con un diseño que se adapta a tu espacio.',
    color: 'sage',
    priceCents: 850000,
    dimensions: { width: 180, height: 70, depth: 100 },
  },
  {
    name: 'Lámpara Órbita',
    category: 'Decoración',
    description: 'Pantalla decorativa. No incluye componentes eléctricos.',
    color: 'sand',
    priceCents: 2400000,
    dimensions: { width: 160, height: 200, depth: 160 },
  },
];
for (const demo of demos)
  await Product.updateOne(
    { name: demo.name },
    { $setOnInsert: demo },
    { upsert: true },
  );
console.log('Productos de ejemplo creados. Reemplazalos antes de publicar.');
await mongoose.disconnect();
