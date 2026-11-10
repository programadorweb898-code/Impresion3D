import { orderSchema, canonicalCartItem } from '@impresion3d/shared';
import { cartStorageKeyFor } from './cart-state.js';
const keyFor = (userId) => {
  const key = cartStorageKeyFor(userId);
  if (!key) throw new Error('Ingresá para enviar el pedido.');
  return key + ':checkout';
};
export function pendingCheckout(userId, storage = localStorage) {
  const raw = storage.getItem(keyFor(userId));
  if (!raw) return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      'No pudimos recuperar el envío pendiente. Revisá Mis pedidos antes de continuar.',
    );
  }
  const parsed = orderSchema.safeParse(value);
  if (!parsed.success || !parsed.data.requestId)
    throw new Error(
      'No pudimos recuperar el envío pendiente. Revisá Mis pedidos antes de continuar.',
    );
  return parsed.data;
}
const signature = (body) =>
  JSON.stringify({
    items: body.items
      .map(canonicalCartItem)
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    notes: (body.notes || '').trim(),
  });
export function prepareCheckout(userId, body, storage = localStorage) {
  const previous = pendingCheckout(userId, storage);
  if (previous && signature(previous) === signature(body)) return previous;
  const attempt = orderSchema.parse({
    ...body,
    requestId: crypto.randomUUID(),
  });
  try {
    storage.setItem(keyFor(userId), JSON.stringify(attempt));
  } catch {
    throw new Error(
      'No pudimos guardar el intento de envío. Habilitá el almacenamiento del sitio en tu navegador antes de enviar.',
    );
  }
  return attempt;
}
export function clearCheckout(userId, storage = localStorage) {
  storage.removeItem(keyFor(userId));
}
export function completeCheckout(userId, storage = localStorage) {
  storage.setItem(
    cartStorageKeyFor(userId),
    JSON.stringify({ version: 1, items: [] }),
  );
  clearCheckout(userId, storage);
}
