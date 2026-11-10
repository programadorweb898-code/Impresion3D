import { canonicalCartItem } from '@impresion3d/shared';
import { cartCatalog } from './offers.js';
import { createHash } from 'node:crypto';
import { Order } from './models.js';
function publicOrder(doc) {
  const value = doc.toObject();
  delete value.requestHash;
  delete value.requestId;
  delete value.notification;
  return value;
}
export async function submitCatalogOrder(req, res) {
  const { items, notes, requestId, delivery } = req.body;
  const requestHash = requestId
    ? createHash('sha256')
        .update(
          JSON.stringify({
            items: items
              .map(canonicalCartItem)
              .sort((a, b) => a.productId.localeCompare(b.productId)),
            notes,
            ...(delivery ? { delivery } : {}),
          }),
        )
        .digest('hex')
    : undefined;
  const replay = async () => {
    const existing = await Order.findOne({
      userId: req.session.userId,
      requestId,
    }).select('+requestHash');
    if (!existing) return false;
    if (existing.requestHash !== requestHash)
      res.status(409).json({
        message:
          'Ese intento ya corresponde a otro pedido. Revisá tu historial antes de enviar uno nuevo.',
        code: 'ORDER_KEY_REUSED',
      });
    else res.json(publicOrder(existing));
    return true;
  };
  if (requestId && (await replay())) return;
  let products;
  try {
    products = await cartCatalog(items);
  } catch (error) {
    if (!error.offerError) throw error;
    return res
      .status(error.status)
      .json({ message: error.message, code: 'PRODUCT_UNAVAILABLE' });
  }
  const byId = new Map(products.map((p) => [String(p._id), p]));
  if (items.some((i) => !byId.has(i.productId)))
    return res.status(404).json({
      message:
        'Un producto del carrito ya no está disponible. Actualizá el carrito y quitá los productos no disponibles.',
      code: 'PRODUCT_UNAVAILABLE',
    });
  if (new Set(products.map((p) => p.currency)).size !== 1)
    return res.status(400).json({
      message: 'Los productos del pedido deben tener la misma moneda.',
    });
  if (
    items.some(
      (i) =>
        i.expectedUnitPriceCents !== undefined &&
        i.expectedUnitPriceCents !== byId.get(i.productId).priceCents,
    )
  )
    return res.status(409).json({
      message:
        'Cambió el precio de un producto. Revisá el total actualizado antes de volver a enviar.',
      code: 'PRICE_CHANGED',
    });
  const snapshots = items.map(({ productId, quantity }) => {
    const product = byId.get(productId);
    return {
      productId: product._id,
      name:
        product.name + (product.offer ? ' — ' + product.selectionSummary : ''),
      ...(product.offer ? { offer: product.offer } : {}),
      unitPriceCents: product.priceCents,
      quantity,
      dimensions: product.dimensions,
    };
  });
  if (
    snapshots.some(
      (i) => !Number.isSafeInteger(i.unitPriceCents) || i.unitPriceCents < 0,
    )
  )
    return res.status(409).json({
      message:
        'Un producto no tiene un precio válido. Consultanos antes de enviar el pedido.',
    });
  try {
    const order = await Order.create({
      userId: req.session.userId,
      items: snapshots,
      totalCents: snapshots.reduce(
        (sum, i) => sum + i.unitPriceCents * i.quantity,
        0,
      ),
      currency: products[0].currency,
      notes,
      ...(delivery
        ? {
            delivery: {
              method: delivery.method,
              originPostalCode: '1755',
              ...(delivery.method === 'pickup'
                ? { costCents: 0, status: 'free_pickup' }
                : { postalCode: delivery.postalCode, status: 'pending_quote' }),
            },
          }
        : {}),
      requestId,
      requestHash,
      history: [{ status: 'en_espera', at: new Date() }],
    });
    res.status(201).json(publicOrder(order));
  } catch (error) {
    if (requestId && error.code === 11000 && (await replay())) return;
    throw error;
  }
}
