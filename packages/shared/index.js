import { z } from 'zod';
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(80),
  password: z.string().min(12, 'Usá al menos 12 caracteres').max(128),
});
export const orderSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/i),
  quantity: z.number().int().min(1).max(20),
  notes: z.string().trim().max(1000).default(''),
});

export const productSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1500),
  category: z.string().trim().min(1).max(60),
  color: z.enum(['terracotta', 'sage', 'sand']),
  priceCents: z.number().int().min(0).max(100000000),
  currency: z.literal('ARS'),
  dimensions: z.strictObject({
    width: z.number().positive().max(2000),
    height: z.number().positive().max(2000),
    depth: z.number().positive().max(2000),
  }),
  active: z.boolean(),
});
export const statusLabels = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  en_fabricacion: 'En fabricación',
  terminado: 'Terminado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
export const statusTransitions = {
  recibido: ['en_revision', 'cancelado'],
  en_revision: ['aprobado', 'cancelado'],
  aprobado: ['en_fabricacion', 'cancelado'],
  en_fabricacion: ['terminado', 'cancelado'],
  terminado: ['entregado'],
  entregado: [],
  cancelado: [],
};
export const orderUpdateSchema = z.strictObject({
  status: z.enum(Object.keys(statusLabels)),
  estimatedReadyAt: z.iso.datetime().nullable(),
  version: z.number().int().nonnegative(),
});
