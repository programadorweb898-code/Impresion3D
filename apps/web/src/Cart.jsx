import { offerPath, selectionCount } from '@impresion3d/shared';
import { formatMoney as money } from '@impresion3d/shared';
export function Cart({
  items,
  products,
  notes,
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
  const byId = new Map(products.map((p) => [p._id, p]));
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
              Actualizar catálogo
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
            <p className="small">
              El servidor confirma precios y disponibilidad al enviar. El plazo
              y cualquier costo de entrega se acuerdan después de revisar la
              solicitud.
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
                busy || refreshing || catalogError || unavailable || mixed
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
