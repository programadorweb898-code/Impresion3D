import { ProductGallery } from './ProductGallery.jsx';
import { useEffect, useState } from 'react';
import { formatMoney } from '@impresion3d/shared';
import { api } from './api.js';
const formatCentimeters = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(
        value / 10,
      ) + ' cm'
    : 'A confirmar';
export function ProductDetails({ id, onAdd, onContinue, inCart, authReady }) {
  const [state, setState] = useState({
    id,
    product: null,
    error: '',
    loading: true,
  });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      setState({
        id,
        product: null,
        error: 'El enlace no corresponde a un producto disponible.',
        loading: false,
      });
      return;
    }
    setState({ id, product: null, error: '', loading: true });
    api('/products/' + id, { signal: controller.signal })
      .then((product) => {
        if (active) setState({ id, product, error: '', loading: false });
      })
      .catch((error) => {
        if (active)
          setState({ id, product: null, error: error.message, loading: false });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);
  if (state.id !== id || state.loading)
    return (
      <section className="product-details" data-page-loading>
        <p role="status">Cargando producto…</p>
      </section>
    );
  if (!state.product)
    return (
      <section className="product-details">
        <h1>Producto no disponible</h1>
        <p role="alert">{state.error}</p>
        <button className="outline" onClick={onContinue}>
          Continuar comprando
        </button>
      </section>
    );
  const p = state.product;
  return (
    <section className="product-details" aria-labelledby="product-detail-title">
      <p className="eyebrow">{p.category}</p>
      <h1 id="product-detail-title">{p.name}</h1>
      <ProductGallery key={p._id} product={p} />

      <div className="product-detail-copy">
        <h2>Descripción del producto</h2>
        <p className="product-detail-description">
          {p.description ||
            'Consultanos para conocer más detalles de esta pieza.'}
        </p>
        <h2>Medidas</h2>
        <dl className="product-detail-dimensions">
          <div>
            <dt>Ancho</dt>
            <dd>{formatCentimeters(p.dimensions?.width)}</dd>
          </div>
          <div>
            <dt>Alto</dt>
            <dd>{formatCentimeters(p.dimensions?.height)}</dd>
          </div>
          <div>
            <dt>Profundidad</dt>
            <dd>{formatCentimeters(p.dimensions?.depth)}</dd>
          </div>
        </dl>
        <p className="product-detail-price">
          {formatMoney(p.priceCents, p.currency)}
        </p>
        <p className="small product-order-note">
          Hecho a pedido. Coordinamos el pago y la entrega con vos.
        </p>
        <div className="product-detail-actions">
          <button
            className="primary"
            disabled={!authReady || inCart}
            onClick={() => onAdd(p)}
          >
            {inCart ? 'En el carrito' : 'Agregar al carrito'}
          </button>
          <button className="outline" onClick={onContinue}>
            Continuar comprando
          </button>
        </div>
        {inCart && (
          <p className="small">Podés modificar la cantidad desde el carrito.</p>
        )}
      </div>
    </section>
  );
}
