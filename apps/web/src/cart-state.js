import { cartItemsSchema } from '@impresion3d/shared';
export const cartStorageKey = 'impresion3d.cart.v1';
export function cartStorageKeyFor(userId) {
  return /^[a-f0-9]{24}$/i.test(userId || '')
    ? cartStorageKey + ':' + userId.toLowerCase()
    : null;
}
export function loadCart(storage, userId) {
  const key = cartStorageKeyFor(userId);
  if (!key) return [];
  try {
    const source = storage ?? globalThis.localStorage;
    const data = JSON.parse(source.getItem(key));
    if (data?.version !== 1) return [];
    const result = cartItemsSchema.safeParse(data.items);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}
export function saveCart(items, storage, userId) {
  const key = cartStorageKeyFor(userId);
  if (!key) return;
  try {
    (storage ?? globalThis.localStorage).setItem(
      key,
      JSON.stringify({ version: 1, items: cartItemsSchema.parse(items) }),
    );
  } catch {
    /* Keep the in-memory cart usable when browser storage is unavailable. */
  }
}
export function addCartItem(items, productId) {
  const current = items.find((i) => i.productId === productId);
  if (current)
    throw new Error(
      'Ese producto ya está en tu carrito. Cambiá la cantidad desde Carrito.',
    );
  if (items.length >= 20)
    throw new Error('El carrito admite hasta 20 productos distintos.');
  return [...items, { productId, quantity: 1 }];
}
export function changeCartQuantity(items, productId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20)
    throw new Error('Elegí una cantidad entre 1 y 20.');
  return items.map((i) => (i.productId === productId ? { ...i, quantity } : i));
}
