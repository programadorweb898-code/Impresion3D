import { cartItemsSchema } from '@impresion3d/shared';
import { useState, useEffect } from 'react';
import {
  loadCart,
  saveCart,
  addCartItem,
  changeCartQuantity,
} from './cart-state.js';
export function useCart(userId) {
  const owner = userId || null;
  const [state, setState] = useState(() => ({
    owner,
    items: loadCart(undefined, owner),
  }));
  const ready = state.owner === owner;
  const items = ready && owner ? state.items : [];
  useEffect(() => {
    setState((current) =>
      current.owner === owner
        ? current
        : { owner, items: loadCart(undefined, owner) },
    );
  }, [owner]);
  useEffect(() => {
    if (owner && state.owner === owner) saveCart(state.items, undefined, owner);
  }, [state, owner]);
  const update = (next) => {
    if (!owner || !ready) throw new Error('Ingresá para armar tu carrito.');
    setState({ owner, items: next });
  };
  return {
    items,
    ready,
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    add: (id) => update(addCartItem(items, id)),
    addOffer: (line) => {
      const next = [
        ...items.filter((i) => i.productId !== line.productId),
        line,
      ];
      if (next.length > 20)
        throw new Error('El carrito admite hasta 20 productos distintos.');
      update(cartItemsSchema.parse(next));
    },
    quantity: (id, q) => update(changeCartQuantity(items, id, q)),
    remove: (id) => update(items.filter((i) => i.productId !== id)),
    clear: () => update([]),
  };
}
