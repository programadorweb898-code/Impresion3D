import { Router } from 'express';
import {
  cartItemsSchema,
  offerDefinitions,
  ballColors,
  offerPriceCents,
  offerSelectionError,
} from '@impresion3d/shared';
import { Product } from './models.js';
const trayId = '6aebbe01d3ce05ca9019abcc';
const ballId = '6aebd7f3acda2c45fbf8110e';
const fail = (message, status = 404) =>
  Object.assign(new Error(message), { status, offerError: true });
export async function availableOffer(id) {
  const definition = offerDefinitions[id];
  if (!Object.hasOwn(offerDefinitions, id))
    throw fail('Esta oferta no está disponible.');
  let options;
  if (id === 'navidad-combo') {
    const tray = await Product.findOne({ _id: trayId, active: true }).lean();
    if (!tray) throw fail('La bandeja de esta oferta no está disponible.');
    const products = await Product.find({
      active: true,
      description: /tejid/i,
      name: { $not: /bola|llavero|bandeja/i },
    })
      .sort({ name: 1, _id: 1 })
      .lean();
    options = products.map((p) => ({
      id: String(p._id),
      name: p.description?.split(' impresa')[0]?.split(' impreso')[0] || p.name,
      image: p.image?.url || '',
      productName: p.name,
    }));
    if (options.length < 4)
      throw fail('No hay cuatro adornos disponibles para armar esta oferta.');
  } else if (id === 'navidad-bolas') {
    if (!(await Product.exists({ _id: ballId, active: true })))
      throw fail('Estas bolas navideñas no están disponibles.');
    options = ballColors.map((color, index) => ({
      ...color,
      spriteIndex: index,
    }));
  } else {
    const products = await Product.find({ active: true, name: /^llavero/i })
      .sort({ name: 1 })
      .lean();
    options = products.map((p) => ({
      id: String(p._id),
      name: p.name,
      image: p.image?.url || '',
    }));
    if (!options.length)
      throw fail('No hay llaveros disponibles para esta oferta.');
  }
  return { id, ...definition, options, currency: 'ARS' };
}
export async function quoteOfferItem(item) {
  const offer = item.offer;
  if (
    !offer ||
    offerDefinitions[offer.id]?.productId !== item.productId ||
    item.quantity !== 1 ||
    offerSelectionError(offer)
  )
    throw fail('La selección de la oferta no está completa.', 400);
  const data = await availableOffer(offer.id);
  const byId = new Map(data.options.map((o) => [o.id, o]));
  if (offer.selections.some((s) => !byId.has(s.id)))
    throw fail(
      'Una opción de la oferta ya no está disponible. Volvé a elegir la selección.',
    );
  const selections = offer.selections.map((s) => ({
    ...s,
    name: byId.get(s.id).name,
  }));
  return {
    _id: data.productId,
    name: data.name,
    currency: 'ARS',
    priceCents: offerPriceCents(offer),
    image: { url: data.image },
    offer: { id: offer.id, mode: offer.mode, selections },
    selectionSummary: selections
      .map((s) => `${s.name} × ${s.quantity}`)
      .join(' · '),
  };
}
export async function cartCatalog(items, { preview = false } = {}) {
  const products = await Product.find({
    _id: { $in: items.filter((i) => !i.offer).map((i) => i.productId) },
    active: true,
  }).lean();
  for (const item of items.filter((i) => i.offer)) {
    try {
      products.push(await quoteOfferItem(item));
    } catch (error) {
      if (!preview || !error.offerError) throw error;
    }
  }
  return products;
}
export function offersRouter(authenticated) {
  const router = Router();
  router.get('/:id', async (req, res) => {
    try {
      res.json(await availableOffer(req.params.id));
    } catch (error) {
      if (error.offerError)
        return res.status(error.status).json({ message: error.message });
      throw error;
    }
  });
  router.post('/cart/preview', authenticated, async (req, res) => {
    const parsed = cartItemsSchema.safeParse(req.body?.items);
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.issues[0].message });
    res.json(await cartCatalog(parsed.data, { preview: true }));
  });
  return router;
}
