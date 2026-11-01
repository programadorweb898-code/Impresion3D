import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareCheckout,
  pendingCheckout,
  completeCheckout,
} from '../../web/src/checkout-state.js';
test('recarga recupera clave, comentarios y precios originales; separa usuarios y libera sólo tras vaciar el carrito', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const user = 'a'.repeat(24);
  const body = {
    items: [
      { productId: 'c'.repeat(24), quantity: 2, expectedUnitPriceCents: 10050 },
    ],
    notes: 'Azul',
  };
  const first = prepareCheckout(user, body, storage);
  const replay = prepareCheckout(
    user,
    { ...body, items: [{ ...body.items[0], expectedUnitPriceCents: 20000 }] },
    storage,
  );
  assert.deepEqual(replay, first);
  assert.equal(pendingCheckout(user, storage).notes, 'Azul');
  assert.equal(pendingCheckout('b'.repeat(24), storage), null);
  assert.notEqual(
    prepareCheckout(user, { ...body, notes: 'Rojo' }, storage).requestId,
    first.requestId,
  );
  assert.throws(() =>
    completeCheckout(user, {
      ...storage,
      setItem() {
        throw new Error('quota');
      },
    }),
  );
  assert.ok(pendingCheckout(user, storage));
  completeCheckout(user, storage);
  assert.equal(pendingCheckout(user, storage), null);
  assert.notEqual(
    prepareCheckout(user, body, storage).requestId,
    first.requestId,
  );
});
