import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIPPING_POLICY,
  calculateDeliveryCost,
  createShippingService,
  confirmShippingQuote,
  storeShippingQuote,
} from '../src/shipping.js';

test('tarifa, mínimo, envío gratis y límite de 30 km', () => {
  assert.equal(calculateDeliveryCost({
    oneWayMeters: 10000, roundTripMeters: 21000, subtotalCents: 1500000,
  }), 840000);
  assert.equal(calculateDeliveryCost({
    oneWayMeters: 800, roundTripMeters: 1700, subtotalCents: 500000,
  }), 200000);
  assert.equal(calculateDeliveryCost({
    oneWayMeters: 30000, roundTripMeters: 60500, subtotalCents: 12000000,
  }), 0);
  assert.throws(() => calculateDeliveryCost({
    oneWayMeters: 30001, roundTripMeters: 60500, subtotalCents: 12000000,
  }), { code: 'DELIVERY_OUT_OF_RANGE' });
  assert.equal(SHIPPING_POLICY.dailyQuoteLimit, 250);
});

test('solicita a Google ida y vuelta sin exponer origen privado', async () => {
  let headers, requestBody;
  const service = createShippingService({
    apiKey: 'testing-secret', originAddress: 'origen privado, Argentina',
    reserve: async () => true,
    fetchImpl: async (_url, options) => {
      headers = options.headers;
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          routes: [{ distanceMeters: 21000, legs: [
            { distanceMeters: 10000 }, { distanceMeters: 11000 },
          ] }],
        }),
      };
    },
  });
  const calculated = await service.quote({
    streetAddress: 'Calle 123', city: 'Morón', postalCode: '1708',
  }, 1500000);
  assert.equal(calculated.costCents, 840000);
  assert.equal(headers['X-Goog-FieldMask'], 'routes.distanceMeters,routes.legs.distanceMeters');
  assert.deepEqual(requestBody.origin, requestBody.destination);
  assert.equal(requestBody.intermediates.length, 1);
  assert.equal(JSON.stringify(calculated).includes('origen privado'), false);
});

test('la cotización queda vinculada a la sesión, domicilio, carrito y precios', () => {
  const session = {};
  const delivery = {
    method: 'shipping', streetAddress: 'Calle 123',
    city: 'Morón', postalCode: '1708',
  };
  const items = [{ productId: 'a'.repeat(24), quantity: 1 }];
  const quote = storeShippingQuote(session, delivery, items, 1500000, {
    oneWayMeters: 10000, roundTripMeters: 21000, costCents: 840000,
  });
  assert.equal(quote.totalCents, 2340000);
  assert.equal(confirmShippingQuote(session,
    { ...delivery, quoteId: quote.quoteId }, items, 1500000).costCents, 840000);
  assert.throws(() => confirmShippingQuote(session,
    { ...delivery, quoteId: quote.quoteId }, items, 1500001), { code: 'DELIVERY_QUOTE_EXPIRED' });
  assert.throws(() => confirmShippingQuote(session,
    { ...delivery, streetAddress: 'Calle 999', quoteId: quote.quoteId },
    items, 1500000), { code: 'DELIVERY_QUOTE_EXPIRED' });
  session.deliveryQuote.expiresAt = Date.now() - 1;
  assert.throws(() => confirmShippingQuote(session,
    { ...delivery, quoteId: quote.quoteId }, items, 1500000),
  { code: 'DELIVERY_QUOTE_EXPIRED' });
});

test('sin clave API no se inventan cotizaciones', async () => {
  const service = createShippingService({
    apiKey: '', originAddress: '', reserve: async () => true,
  });
  await assert.rejects(service.quote({
    streetAddress: 'Calle 123', city: 'Morón', postalCode: '1708',
  }, 10000), { code: 'DELIVERY_UNAVAILABLE' });
});
