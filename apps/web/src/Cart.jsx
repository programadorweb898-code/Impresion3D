import { useState, lazy, Suspense } from 'react';
const DeliveryLocation = lazy(() => import('./DeliveryLocation.jsx'));
import { api } from './api.js';
import { offerPath, selectionCount } from '@impresion3d/shared';
import { formatMoney as money } from '@impresion3d/shared';
export function Cart({
  items,
  products,
  notes,
  delivery = {
    method: 'shipping',
    streetAddress: '',
    city: '',
    postalCode: '',
  },
  onDelivery,
  onNotes,
  onQuantity,
  onRemove,
  onClear,
  onSubmit,
  onRefresh,
  onContinue,
  onOffer,
  busy,
  refreshing,
  catalogError,
}) {
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const byId = new Map(products.map((p) => [p._id, p]));
  const fingerprint = JSON.stringify(
    items.map((i) => [
      i.productId,
      i.quantity,
      byId.get(i.productId)?.priceCents,
    ]),
  );
  const quoted =
    quote &&
    quote.fingerprint === fingerprint &&
    quote.quoteId === delivery.quoteId &&
    delivery.method === 'shipping';
  function editDelivery(next) {
    setQuote(null);
    setQuoteError('');
    onDelivery({ ...next, method: 'shipping', quoteId: undefined });
  }
  async function calculateShipping() {
    setQuoting(true);
    setQuoteError('');
    setQuote(null);
    try {
      const destination = {
        method: 'shipping',
        streetAddress: (delivery.streetAddress || '').trim(),
        city: (delivery.city || '').trim(),
        postalCode: (delivery.postalCode || '').trim().toUpperCase(),
        provinceId: delivery.provinceId,
        localityId: delivery.localityId,
      };
      const result = await api('/shipping/quote', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({
            ...i,
            expectedUnitPriceCents: byId.get(i.productId)?.priceCents,
          })),
          delivery: destination,
        }),
      });
      onDelivery({ ...destination, quoteId: result.quoteId });
      setQuote({ ...result, fingerprint });
    } catch (error) {
      setQuoteError(error.message);
      onDelivery({ ...delivery, quoteId: undefined });
    } finally {
      setQuoting(false);
    }
  }
  const confirmed = !refreshing && !catalogError;
  const rows = items.map((i) => {
    const product = byId.get(i.productId);
    return {
      ...i,
      product,
      name:
        product?.name ||
        (refreshing
          ? 'Actualizando producto…'
          : catalogError
            ? 'Producto sin verificar'
            : 'Producto no disponible'),
    };
  });
  const unavailable = confirmed && rows.some((i) => !i.product);
  const currencies = new Set(
    rows.filter((i) => i.product).map((i) => i.product.currency),
  );
  const mixed = confirmed && currencies.size > 1,
    currency = [...currencies][0] || 'ARS';
  const total = rows.reduce(
    (sum, i) => sum + (i.product?.priceCents || 0) * i.quantity,
    0,
  );
  return (
    <section className="cart-page">
      <h1 id="cart-title">Tu carrito</h1>
      <p>
        Reuní tus productos y envianos una sola solicitud. El pago y la entrega
        se coordinan personalmente.
      </p>
      {!items.length ? (
        <div className="empty">
          <p>Tu carrito está vacío.</p>
          <button className="primary" onClick={onContinue}>
            Explorar el catálogo
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="cart-actions">
            <button
              type="button"
              className="outline"
              disabled={busy || refreshing}
              onClick={onRefresh}
            >
              Actualizar precios y disponibilidad
            </button>
            <button type="button" disabled={busy} onClick={onContinue}>
              Seguir eligiendo
            </button>
          </div>
          {refreshing && (
            <p role="status">Actualizando precios y disponibilidad…</p>
          )}
          {catalogError && (
            <p className="error" role="alert">
              No pudimos actualizar el catálogo. Reintentá antes de enviar tu
              pedido.
            </p>
          )}
          {unavailable && (
            <p className="error" role="alert">
              Quitá los productos que ya no están disponibles para continuar.
            </p>
          )}
          {mixed && (
            <p className="error" role="alert">
              No se pueden combinar productos con distinta moneda en el mismo
              pedido.
            </p>
          )}
          <div className="cart-items">
            {rows.map(({ productId, quantity, product, name }) => (
              <article className="cart-item" key={productId}>
                {product?.image?.url && (
                  <img
                    src={product.image.url}
                    alt={product.name}
                    className="cart-photo"
                  />
                )}
                <div className="cart-item-info">
                  <h2>{name}</h2>
                  <p className="cart-quantity">
                    {product?.offer ? 'Piezas elegidas: ' : 'Cantidad: '}
                    <strong>
                      {product?.offer
                        ? selectionCount(product.offer.selections)
                        : quantity}
                    </strong>
                  </p>
                  {product && (
                    <p>
                      {product.offer ? 'Esta oferta: ' : 'Por unidad: '}
                      {money(product.priceCents, product.currency)}
                    </p>
                  )}
                  <div className="cart-item-actions">
                    {product?.offer ? (
                      <>
                        <p className="cart-offer-selection">
                          {product.selectionSummary}
                        </p>
                        <a
                          className="cart-offer-edit"
                          href={offerPath(product.offer.id)}
                          onClick={(event) => {
                            if (
                              onOffer &&
                              event.button === 0 &&
                              !event.metaKey &&
                              !event.ctrlKey &&
                              !event.shiftKey &&
                              !event.altKey
                            ) {
                              event.preventDefault();
                              onOffer(product.offer.id);
                            }
                          }}
                        >
                          Editar selección
                        </a>
                      </>
                    ) : (
                      <label>
                        Cantidad de {name}
                        <select
                          aria-label={'Cantidad de ' + name}
                          value={quantity}
                          disabled={busy}
                          onChange={(e) =>
                            onQuantity(productId, Number(e.target.value))
                          }
                        >
                          {Array.from({ length: 20 }, (_, n) => (
                            <option key={n + 1} value={n + 1}>
                              {n + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      className="remove-item"
                      aria-label={'Quitar ' + name}
                      onClick={() => onRemove(productId)}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
                {product && (
                  <strong className="cart-subtotal">
                    {money(product.priceCents * quantity, product.currency)}
                  </strong>
                )}
              </article>
            ))}
          </div>
          <div className="cart-summary">
            <div className="flex justify-between gap-4">
              <h2>Total de productos</h2>
              <strong>
                {!confirmed || mixed ? '—' : money(total, currency)}
              </strong>
            </div>
            <fieldset className="delivery-options" disabled={busy || quoting}>
              <legend>Entrega a domicilio</legend>
              <p className="small">
                Ingresá el domicilio para conocer el costo antes de confirmar.
              </p>
              <div className="delivery-details">
                <label htmlFor="delivery-street-address">Calle y altura</label>
                <input
                  id="delivery-street-address"
                  type="text"
                  autoComplete="street-address"
                  required
                  minLength={6}
                  maxLength={120}
                  placeholder="Ej.: San Martín 123"
                  value={delivery.streetAddress || ''}
                  onChange={(event) =>
                    editDelivery({
                      ...delivery,
                      streetAddress: event.target.value,
                    })
                  }
                />
                <Suspense fallback={<p role="status">Cargando localidades…</p>}>
                  <DeliveryLocation
                    delivery={delivery}
                    onChange={editDelivery}
                  />
                </Suspense>
                <label htmlFor="delivery-postal-code">
                  Código postal de destino
                </label>
                <input
                  id="delivery-postal-code"
                  type="text"
                  autoComplete="postal-code"
                  maxLength={8}
                  required
                  pattern="([0-9]{4}|[A-Za-z][0-9]{4}[A-Za-z]{3})"
                  title="Ingresá 4 números o un CPA completo, como B1755ABC."
                  placeholder="Ej.: 1755 o B1755ABC"
                  value={delivery.postalCode || ''}
                  onChange={(event) =>
                    editDelivery({
                      ...delivery,
                      postalCode: event.target.value.toUpperCase(),
                    })
                  }
                  aria-describedby="delivery-help"
                />
                <p id="delivery-help" className="small">
                  Entregas propias hasta 30 km de ida desde Rafael Castillo.
                  Envío gratis desde $120.000 en productos.
                </p>
                <button
                  type="button"
                  className="outline"
                  disabled={
                    busy ||
                    quoting ||
                    refreshing ||
                    !!catalogError ||
                    unavailable ||
                    mixed ||
                    !delivery.localityId ||
                    !delivery.provinceId ||
                    !delivery.streetAddress?.trim() ||
                    !delivery.postalCode?.trim()
                  }
                  onClick={calculateShipping}
                >
                  {quoting ? 'Calculando distancia…' : 'Calcular envío'}
                </button>
                {quoteError && (
                  <p role="alert" className="error">
                    {quoteError}
                  </p>
                )}
                {quoted && (
                  <p role="status" className="small">
                    Distancia de ida: {quote.oneWayKm} km. Recorrido ida y
                    vuelta: {quote.roundTripKm} km. Envío:{' '}
                    {quote.costCents === 0
                      ? 'GRATIS'
                      : money(quote.costCents, currency)}
                    .
                  </p>
                )}
                {!quoted && !quoteError && (
                  <p className="small">
                    Calculá el envío para confirmar el total.
                  </p>
                )}
              </div>
            </fieldset>
            <div className="delivery-total" aria-live="polite">
              <span>Envío</span>
              <strong>
                {quoted
                  ? quote.costCents === 0
                    ? 'Gratis'
                    : money(quote.costCents, currency)
                  : 'A calcular'}
              </strong>
            </div>
            <div className="delivery-total" aria-live="polite">
              <strong>Total a pagar</strong>
              <strong>
                {!confirmed ||
                mixed ||
                !quoted
                  ? '—'
                  : money(total + (quoted ? quote.costCents : 0), currency)}
              </strong>
            </div>
            <p className="small">
              Confirmamos precios y disponibilidad al enviar. Coordinamos el
              pago y la entrega antes de confirmar el pedido.
            </p>
            <label>
              Comentarios para tu pedido
              <textarea
                value={notes}
                maxLength="1000"
                disabled={busy}
                onChange={(e) => onNotes(e.target.value)}
                placeholder="Colores preferidos u otras consultas"
              />
            </label>
            <button
              className="primary"
              disabled={
                busy ||
                quoting ||
                refreshing ||
                catalogError ||
                unavailable ||
                mixed ||
                !quoted
              }
            >
              {busy ? 'Enviando pedido…' : 'Enviar pedido'}
            </button>
            <button
              type="button"
              disabled={busy}
              className="clear-cart"
              onClick={onClear}
            >
              Vaciar carrito
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
