import { z } from 'zod';
export const offerDefinitions = {
  'navidad-combo': {
    productId: 'f00000000000000000000001',
    name: 'Bandeja navideña + 4 adornos',
    image: '/images/offers/navidad-combo-1200.webp',
    description:
      'Incluye la bandeja y exactamente 4 adornos tejidos a elección por $35.000. La promoción no admite menos ni más de 4 adornos.',
    mode: 'pack',
  },
  'navidad-bolas': {
    productId: 'f00000000000000000000002',
    name: 'Bolas navideñas con efecto tejido',
    image: '/images/offers/navidad-bolas-colores-1200.webp',
    description:
      'Elegí los colores y las cantidades: 1 bola por $3.000 o un pack de exactamente 6 por $15.000. Podés repetir colores.',
    mode: 'pack',
  },
  llaveros: {
    productId: 'f00000000000000000000003',
    name: 'Oferta de llaveros',
    image: '/images/offers/llaveros-1200.webp',
    description:
      'Elegí los diseños y la cantidad: $3.000 por unidad; llevando 5 o más, $2.000 por unidad. Podés repetir diseños.',
    mode: 'custom',
  },
};
export const ballColors = [
  { id: 'blanco', name: 'Blanco', hex: '#f4efe4' },
  { id: 'rojo', name: 'Rojo', hex: '#b32126' },
  { id: 'verde', name: 'Verde', hex: '#1d553a' },
  { id: 'marron', name: 'Marrón', hex: '#693c29' },
  { id: 'dorado', name: 'Dorado metalizado', hex: '#c89a36' },
  { id: 'plateado', name: 'Plateado metalizado', hex: '#b4b7bb' },
];
export const offerPath = (id) =>
  '/descripction/oferta/' + encodeURIComponent(id);
export const selectionCount = (selections) =>
  selections.reduce((sum, item) => sum + item.quantity, 0);
export function offerPriceCents({ id, mode, selections }) {
  if (id === 'navidad-combo') return 3500000;
  if (id === 'navidad-bolas') return mode === 'single' ? 300000 : 1500000;
  const count = selectionCount(selections);
  return count * (count >= 5 ? 200000 : 300000);
}
export function offerSelectionError(offer) {
  const { id, mode, selections } = offer;
  const count = selectionCount(selections);
  if (!count) return 'Elegí los productos de tu oferta.';
  if (
    id === 'navidad-combo' &&
    (mode !== 'pack' ||
      count !== 4 ||
      selections.length !== 4 ||
      selections.some((s) => s.quantity !== 1))
  )
    return 'Esta oferta requiere exactamente 4 adornos diferentes.';
  if (
    id === 'navidad-bolas' &&
    (!['single', 'pack'].includes(mode) ||
      count !== (mode === 'single' ? 1 : 6))
  )
    return mode === 'single'
      ? 'Elegí exactamente 1 bola.'
      : 'El pack requiere exactamente 6 bolas.';
  if (id === 'llaveros' && (mode !== 'custom' || count > 20))
    return 'Elegí entre 1 y 20 llaveros.';
  return '';
}
export const offerConfigurationSchema = z
  .strictObject({
    id: z.enum(Object.keys(offerDefinitions)),
    mode: z.enum(['single', 'pack', 'custom']),
    selections: z
      .array(
        z.strictObject({
          id: z
            .string()
            .regex(
              /^(?:[a-f0-9]{24}|blanco|rojo|verde|marron|dorado|plateado)$/,
            ),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1)
      .max(20)
      .refine(
        (items) => new Set(items.map((x) => x.id)).size === items.length,
        'No repitas una opción; ajustá su cantidad.',
      ),
  })
  .superRefine((offer, ctx) => {
    const message = offerSelectionError(offer);
    if (message) ctx.addIssue({ code: 'custom', message });
  })
  .transform((offer) => ({
    ...offer,
    selections: [...offer.selections].sort((a, b) => a.id.localeCompare(b.id)),
  }));
export function checkOfferItem(item, ctx) {
  const definition = Object.values(offerDefinitions).find(
    (o) => o.productId === item.productId,
  );
  if (
    item.offer
      ? offerDefinitions[item.offer.id]?.productId !== item.productId ||
        item.quantity !== 1
      : definition
  )
    ctx.addIssue({
      code: 'custom',
      message:
        'Revisá la selección de la oferta. Para cambiar sus piezas, usá Editar selección.',
    });
}
export const canonicalCartItem = ({ productId, quantity, offer }) => ({
  productId,
  quantity,
  ...(offer
    ? {
        offer: {
          ...offer,
          selections: [...offer.selections].sort((a, b) =>
            a.id.localeCompare(b.id),
          ),
        },
      }
    : {}),
});
