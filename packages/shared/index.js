import { z } from 'zod';
export const loginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(128) });
export const registerSchema = loginSchema.extend({ name: z.string().trim().min(2).max(80), password: z.string().min(12, 'Usá al menos 12 caracteres').max(128) });
export const orderSchema = z.object({ productId: z.string().regex(/^[a-f0-9]{24}$/i), quantity: z.number().int().min(1).max(20), notes: z.string().trim().max(1000).default('') });
