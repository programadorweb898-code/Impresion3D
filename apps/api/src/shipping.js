import { createHash, randomUUID } from 'node:crypto';
import { canonicalCartItem } from '@impresion3d/shared';
import { ShippingUsage } from './models.js';

export const SHIPPING_POLICY = Object.freeze({
  rateCentsPerKm: 40000, // ARS 400 por km recorrido
  minimumCents: 200000, // ARS 2.000
  freeFromCents: 12000000, // ARS 120.000 de productos
  maximumOneWayMeters: 30000,
  dailyQuoteLimit: 250,
  quoteLifetimeMs: 10 * 60 * 1000,
});

export function shippingFingerprint(items, subtotalCents) {
  return createHash('sha256')
    .update(JSON.stringify({
      items: items.map(canonicalCartItem).sort((a, b) =>
        a.productId.localeCompare(b.productId)),
      subtotalCents,
    }))
    .digest('hex');
}

export function calculateDeliveryCost({
  oneWayMeters,
  roundTripMeters,
  subtotalCents,
}, policy = SHIPPING_POLICY) {
  if (!Number.isSafeInteger(oneWayMeters) || oneWayMeters < 0 ||
      !Number.isSafeInteger(roundTripMeters) || roundTripMeters < oneWayMeters ||
      !Number.isSafeInteger(subtotalCents) || subtotalCents < 0) {
    throw new Error('Distancia o subtotal inválido');
  }
  if (oneWayMeters > policy.maximumOneWayMeters) {
    const error = new Error('La dirección está fuera de nuestra zona de entrega de 30 km.');
    error.status = 422;
    error.code = 'DELIVERY_OUT_OF_RANGE';
    throw error;
  }
  return subtotalCents >= policy.freeFromCents
    ? 0
    : Math.max(
        policy.minimumCents,
        Math.round((roundTripMeters * policy.rateCentsPerKm) / 1000),
      );
}

function serviceError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

async function reserveQuote() {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const result = await ShippingUsage.findOneAndUpdate(
      { _id: day, count: { $lt: SHIPPING_POLICY.dailyQuoteLimit } },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(Date.now() + 3 * 86400000) },
      },
      { upsert: true, new: true },
    );
    return !!result;
  } catch (error) {
    // At the quota edge, MongoDB's unique _id prevents a concurrent upsert.
    if (error.code === 11000) return false;
    throw error;
  }
}

export function createShippingService({
  apiKey = process.env.GOOGLE_MAPS_API_KEY,
  originAddress = process.env.DELIVERY_ORIGIN_ADDRESS,
  fetchImpl = fetch,
  reserve = reserveQuote,
} = {}) {
  return {
    async quote(delivery, subtotalCents) {
      if (!apiKey || !originAddress)
        throw serviceError(503, 'DELIVERY_UNAVAILABLE',
          'La cotización de entrega todavía no está habilitada. Podés elegir retiro.');
      if (!(await reserve()))
        throw serviceError(429, 'DELIVERY_DAILY_LIMIT',
          'Por hoy alcanzamos el límite de cotizaciones. Intentá mañana o consultanos.');
      const destination = [
        delivery.streetAddress,
        delivery.city,
        delivery.postalCode,
        'Argentina',
      ].join(', ');
      const origin = originAddress;
      let response;
      try {
        response = await fetchImpl(
          'https://routes.googleapis.com/directions/v2:computeRoutes',
          {
            method: 'POST',
            signal: AbortSignal.timeout(8000),
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'routes.distanceMeters,routes.legs.distanceMeters',
            },
            body: JSON.stringify({
              origin: { address: origin },
              intermediates: [{ address: destination }],
              destination: { address: origin },
              travelMode: 'DRIVE',
              routingPreference: 'TRAFFIC_UNAWARE',
              languageCode: 'es-AR',
              regionCode: 'AR',
            }),
          },
        );
      } catch {
        throw serviceError(502, 'DELIVERY_PROVIDER_ERROR',
          'No pudimos consultar la distancia. Volvé a intentar.');
      }
      if (!response.ok)
        throw serviceError(502, 'DELIVERY_PROVIDER_ERROR',
          'No pudimos obtener la distancia de esa dirección. Revisala e intentá nuevamente.');
      let result;
      try {
        result = await response.json();
      } catch {
        throw serviceError(502, 'DELIVERY_PROVIDER_ERROR',
          'El servicio de distancias respondió de manera inesperada.');
      }
      const route = result.routes?.[0];
      const oneWayMeters = route?.legs?.[0]?.distanceMeters;
      const roundTripMeters = route?.distanceMeters;
      if (!Number.isSafeInteger(oneWayMeters) ||
          !Number.isSafeInteger(roundTripMeters) ||
          route.legs.length !== 2)
        throw serviceError(422, 'DELIVERY_ADDRESS_INVALID',
          'No encontramos un recorrido en auto a ese domicilio. Revisá calle, altura, localidad y CP.');
      const costCents = calculateDeliveryCost({
        oneWayMeters, roundTripMeters, subtotalCents,
      });
      return { oneWayMeters, roundTripMeters, costCents };
    },
  };
}

export function confirmShippingQuote(session, delivery, items, subtotalCents) {
  const quote = session.deliveryQuote;
  if (!quote || quote.expiresAt <= Date.now() ||
      quote.quoteId !== delivery.quoteId ||
      quote.fingerprint !== shippingFingerprint(items, subtotalCents) ||
      quote.streetAddress !== delivery.streetAddress ||
      quote.city !== delivery.city ||
      quote.postalCode !== delivery.postalCode) {
    throw serviceError(409, 'DELIVERY_QUOTE_EXPIRED',
      'La cotización venció o cambió el carrito/domicilio. Calculá nuevamente el envío.');
  }
  return quote;
}

function publicQuote(quote, subtotalCents) {
  return {
    quoteId: quote.quoteId,
    subtotalCents,
    costCents: quote.costCents,
    totalCents: subtotalCents + quote.costCents,
    oneWayKm: Number((quote.oneWayMeters / 1000).toFixed(1)),
    roundTripKm: Number((quote.roundTripMeters / 1000).toFixed(1)),
    freeShipping: quote.costCents === 0,
  };
}

export function reuseShippingQuote(session, delivery, items, subtotalCents) {
  const quote = session.deliveryQuote;
  if (!quote || quote.expiresAt <= Date.now() ||
      quote.fingerprint !== shippingFingerprint(items, subtotalCents) ||
      quote.streetAddress !== delivery.streetAddress ||
      quote.city !== delivery.city || quote.postalCode !== delivery.postalCode)
    return null;
  return publicQuote(quote, subtotalCents);
}

export function storeShippingQuote(session, delivery, items, subtotalCents, calculated) {
  const quote = {
    quoteId: randomUUID(),
    ...delivery,
    ...calculated,
    fingerprint: shippingFingerprint(items, subtotalCents),
    expiresAt: Date.now() + SHIPPING_POLICY.quoteLifetimeMs,
  };
  session.deliveryQuote = quote;
  return publicQuote(quote, subtotalCents);
}
