import { offerConfigurationSchema, checkOfferItem } from './offers.js';
export * from './offers.js';
import { z } from 'zod';
export { formatMoney } from './money.js';
export const newPasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener entre 8 y 20 caracteres.')
  .max(20, 'La contraseña debe tener entre 8 y 20 caracteres.')
  .regex(/[A-Z]/, 'Incluí al menos una mayúscula.')
  .regex(/[a-z]/, 'Incluí al menos una minúscula.')
  .regex(/[0-9]/, 'Incluí al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Incluí al menos un carácter especial.');
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Formato de email no válido.' })),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(80),
  password: newPasswordSchema,
});
const productIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i)
  .toLowerCase();
const quantitySchema = z.number().int().min(1).max(20);
const notesSchema = z.string().trim().max(1000).default('');
const distinctItems = (items) =>
  new Set(items.map((item) => item.productId)).size === items.length;
export const cartItemsSchema = z
  .array(
    z
      .object({
        productId: productIdSchema,
        quantity: quantitySchema,
        offer: offerConfigurationSchema.optional(),
      })
      .superRefine(checkOfferItem),
  )
  .max(20)
  .refine(distinctItems, 'No repitas el mismo producto en el carrito.');
const checkoutItemsSchema = z
  .array(
    z
      .object({
        productId: productIdSchema,
        quantity: quantitySchema,
        offer: offerConfigurationSchema.optional(),
        expectedUnitPriceCents: z.number().int().nonnegative().optional(),
      })
      .superRefine(checkOfferItem),
  )
  .min(1, 'El carrito está vacío.')
  .max(20)
  .refine(distinctItems, 'No repitas el mismo producto en el carrito.');
export const orderSchema = z.union([
  z.object({
    items: checkoutItemsSchema,
    notes: notesSchema,
    requestId: z.uuid().optional(),
  }),
  // Compatibility with pages opened before the cart release.
  z
    .object({
      productId: productIdSchema,
      quantity: quantitySchema,
      notes: notesSchema,
    })
    .transform(({ productId, quantity, notes }) => ({
      items: [{ productId, quantity }],
      notes,
    })),
]);

export const productSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1500),
  shortDescription: z.string().trim().max(180).optional(),
  category: z.string().trim().min(1).max(60),
  color: z.enum(['terracotta', 'sage', 'sand']),
  priceCents: z.number().int().min(0).max(100000000),
  currency: z.literal('ARS'),
  dimensions: z.strictObject({
    width: z.number().positive().max(2000).optional(),
    height: z.number().positive().max(2000),
    depth: z.number().positive().max(2000).optional(),
  }),
  active: z.boolean(),
});
export const productUpdateSchema = productSchema.extend({
  version: z.number().int().nonnegative(),
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
export { legalSite, legalPages, legalPageFromPath } from './legal.js';

export function validationMessage(issue) {
  const field = issue?.path?.[0];
  const label =
    {
      name: 'El nombre',
      description: 'La descripción',
      category: 'La categoría',
      quantity: 'La cantidad',
      notes: 'Los comentarios',
      priceCents: 'El precio',
      width: 'El ancho',
      height: 'El alto',
      depth: 'La profundidad',
    }[field] || 'El dato ingresado';
  // Preserve deliberately written Spanish messages, including password rules.
  if (
    issue?.code === 'custom' ||
    /^(Usá|Incluí|La contraseña|Formato de email|No repitas|El carrito)/.test(
      issue?.message || '',
    )
  )
    return issue.message;
  if (field === 'email')
    return 'Ingresá un correo electrónico con formato válido.';
  if (['token', 'requestId'].includes(field))
    return 'El enlace o la solicitud no son válidos. Volvé a intentarlo.';
  if (['password', 'currentPassword'].includes(field))
    return 'Revisá la contraseña ingresada.';
  if (issue?.code === 'too_small')
    return (
      label + ' no alcanza el mínimo permitido. Revisalo e intentá nuevamente.'
    );
  if (issue?.code === 'too_big')
    return (
      label + ' supera el máximo permitido. Revisalo e intentá nuevamente.'
    );
  return label + ' no es válido. Revisalo e intentá nuevamente.';
}
