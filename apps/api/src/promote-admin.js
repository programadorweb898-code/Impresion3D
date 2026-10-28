import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from './models.js';
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .parse(process.argv[2]);
if (!process.env.MONGODB_URI) throw new Error('Configurá MONGODB_URI');
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: 'admin' } },
    { new: true },
  );
  if (!user)
    throw new Error('Primero registrá la cuenta que querés administrar');
  console.log('Cuenta habilitada para administrar. Volvé a ingresar al sitio.');
} finally {
  await mongoose.disconnect();
}
