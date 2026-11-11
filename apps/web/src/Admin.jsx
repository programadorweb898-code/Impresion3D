import { OrderDelivery } from './OrderDelivery.jsx';
import { WorkerConnections } from './SlicingControls.jsx';
import DesignQuote from './DesignQuote.jsx';
import DesignRequests from './DesignRequests.jsx';
import { ProductGalleryEditor } from './ProductGalleryEditor.jsx';
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Pagination } from './Pagination.jsx';
import { ProductPhoto } from './ProductPhoto.jsx';
import { ProductModel } from './ProductModel.jsx';
import {
  productSchema,
  formatMoney,
  statusLabels,
  statusTransitions,
} from '@impresion3d/shared';
const emptyProduct = {
  name: '',
  description: '',
  shortDescription: '',
  category: 'Hogar',
  color: 'terracotta',
  priceCents: 0,
  currency: 'ARS',
  dimensions: { height: 50 },
  active: true,
};
const toLocalDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
function OrderEditor({ order, onSave, busy }) {
  const [status, setStatus] = useState(order.status);
  const [eta, setEta] = useState(toLocalDate(order.estimatedReadyAt));
  const closed = statusTransitions[order.status].length === 0;
  return (
    <article className="order">
      <div className="flex justify-between flex-wrap gap-3">
        <h3>Pedido #{order._id.slice(-6).toUpperCase()}</h3>
        <strong>{statusLabels[order.status]}</strong>
      </div>
      <p>
        {order.userId?.name || 'Cuenta no disponible'} ·{' '}
        {order.userId?.email || 'Sin correo agregado'}
      </p>
      <p>{new Date(order.createdAt).toLocaleString('es-AR')}</p>
      {order.items.map((item, i) => (
        <p key={i}>
          {item.quantity} × {item.name}
        </p>
      ))}
      {order.notes && <p>Solicitud: {order.notes}</p>}
      <OrderDelivery delivery={order.delivery} />
      <p>
        {order.delivery?.status === 'pending_quote' ? 'Productos (sin envío): ' : 'Total: '}
        {formatMoney(order.totalCents, order.currency)}
      </p>
      <ol>
        {order.history.map((h, i) => (
          <li key={i}>
            {statusLabels[h.status]} · {new Date(h.at).toLocaleString('es-AR')}
          </li>
        ))}
      </ol>
      {closed ? (
        <p>Pedido cerrado.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(order._id, {
              status,
              estimatedReadyAt: eta ? new Date(eta).toISOString() : null,
              version: order.__v,
            });
          }}
        >
          <label>
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {[order.status, ...statusTransitions[order.status]].map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entrega estimada (tu hora local)
            <input
              type="datetime-local"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
            />
          </label>
          <p className="small">
            Dejá la fecha vacía si todavía no podés confirmarla.
          </p>
          <button className="primary" disabled={busy}>
            Guardar seguimiento
          </button>
        </form>
      )}
    </article>
  );
}
export function Admin({ onCatalogChange, onPreview }) {
  const [tab, setTab] = useState('orders'),
    [products, setProducts] = useState([]),
    [operations, setOperations] = useState(null),
    [productPage, setProductPage] = useState({ page: 1, pages: 1, total: 0 }),
    [data, setData] = useState({ orders: [], page: 1, pages: 1, total: 0 }),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true);
  async function load(page = 1, productsPage = productPage.page) {
    setLoading(true);
    try {
      const [items, orders, state] = await Promise.all([
        api('/admin/products?page=' + productsPage),
        api('/admin/orders?page=' + page),
        api('/admin/operations'),
      ]);
      setProducts(items.products);
      setProductPage(items);
      setData(orders);
      setOperations(state);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function saveOrder(id, body) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/admin/orders/' + id, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await load(data.page);
      setNotice('Seguimiento actualizado.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteProduct(id) {
    if (!window.confirm('¿Seguro que querés eliminar este producto del catálogo?')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/admin/products/' + id, { method: 'DELETE' });
      await Promise.all([load(data.page), onCatalogChange()]);
      setNotice('Producto eliminado.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProduct(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = productSchema.safeParse({
      name: values.name,
      description: values.description,
      shortDescription: values.shortDescription,
      category: values.category,
      color: values.color,
      priceCents: Math.round(Number(values.price) * 100),
      currency: 'ARS',
      dimensions: {
        ...(values.width !== '' && { width: Math.round(Number(values.width) * 100) / 10 }),
        height: Math.round(Number(values.height) * 100) / 10,
        ...(values.depth !== '' && { depth: Math.round(Number(values.depth) * 100) / 10 }),
      },
      active: values.active === 'on',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setBusy(false);
      return;
    }
    try {
      await api('/admin/products' + (editing._id ? '/' + editing._id : ''), {
        method: editing._id ? 'PUT' : 'POST',
        body: JSON.stringify(
          editing._id ? { ...parsed.data, version: editing.__v } : parsed.data,
        ),
      });
      setEditing(null);
      await Promise.all([load(data.page), onCatalogChange()]);
      setNotice('Producto guardado.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="orders admin">
      <p className="eyebrow">TU TALLER</p>
      <h1>Administración</h1>
      <div className="filters">
        <button
          aria-pressed={tab === 'orders'}
          className={tab === 'orders' ? 'active' : ''}
          onClick={() => setTab('orders')}
        >
          Pedidos
        </button>
        <button
          aria-pressed={tab === 'products'}
          className={tab === 'products' ? 'active' : ''}
          onClick={() => setTab('products')}
        >
          Productos
        </button>
        <button
          aria-pressed={tab === 'designs'}
          className={tab === 'designs' ? 'active' : ''}
          onClick={() => setTab('designs')}
        >
          Presupuestos 3D
        </button>
        <button
          aria-pressed={tab === 'operations'}
          className={tab === 'operations' ? 'active' : ''}
          onClick={() => setTab('operations')}
        >
          Estado del servicio
        </button>
        <button
          disabled={busy || loading}
          onClick={() => {
            setError('');
            load(data.page).catch((e) => setError(e.message));
          }}
        >
          Actualizar
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Cargando taller…</p>
      ) : tab === 'designs' ? (
        <>
          <WorkerConnections />
          <DesignRequests admin />
          <DesignQuote />
        </>
      ) : tab === 'operations' ? (
        <section>
          <h2>Estado del servicio</h2>
          <p>
            Integraciones habilitadas en este servidor. La configuración no
            sustituye una prueba completa con cada proveedor.
          </p>
          <ul>
            {Object.entries({
              images: 'Fotos',
              models: 'Modelos 3D',
              recovery: 'Recuperación de contraseña',
              verification: 'Confirmación de correo',
              google: 'Google',
              facebook: 'Facebook',
              orderNotifications: 'Avisos de pedidos',
            }).map(([key, label]) => (
              <li key={key}>
                {label}:{' '}
                {operations?.integrations[key]
                  ? 'Habilitado'
                  : 'Sin configurar'}
              </li>
            ))}
          </ul>
          <p>
            Avisos que agotaron sus reintentos:{' '}
            {operations?.failedNotifications || 0}
          </p>
          {operations?.commit && (
            <p className="small">Versión: {operations.commit.slice(0, 7)}</p>
          )}
        </section>
      ) : tab === 'orders' ? (
        <>
          <p>
            {data.total} pedidos · Página {data.page} de {data.pages}
          </p>
          {data.orders.length ? (
            data.orders.map((o) => (
              <OrderEditor
                key={o._id + ':' + o.__v}
                order={o}
                onSave={saveOrder}
                busy={busy}
              />
            ))
          ) : (
            <p className="empty">Todavía no hay solicitudes.</p>
          )}
          <div className="filters">
            <button
              disabled={data.page <= 1 || busy}
              onClick={() =>
                load(data.page - 1).catch((e) => setError(e.message))
              }
            >
              Anterior
            </button>
            <button
              disabled={data.page >= data.pages || busy}
              onClick={() =>
                load(data.page + 1).catch((e) => setError(e.message))
              }
            >
              Siguiente
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="primary" onClick={() => setEditing(emptyProduct)}>
            Nuevo producto
          </button>
          {editing && (
            <form
              className="product-editor"
              key={editing._id || 'new'}
              onSubmit={saveProduct}
            >
              <h2>{editing._id ? 'Editar producto' : 'Nuevo producto'}</h2>
              <label>
                Nombre
                <input
                  name="name"
                  defaultValue={editing.name}
                  minLength="2"
                  maxLength="120"
                  required
                />
              </label>
              <label>
                Descripción breve de la tarjeta
                <textarea
                  name="shortDescription"
                  defaultValue={editing.shortDescription || ''}
                  maxLength="180"
                  aria-describedby="short-description-help"
                />
              </label>
              <p id="short-description-help" className="small">
                Una frase sobre el producto, sin medidas. El detalle y las
                medidas se muestran en su ficha.
              </p>
              <label>
                Descripción detallada de la ficha
                <textarea
                  name="description"
                  defaultValue={editing.description}
                  maxLength="1500"
                  required
                />
              </label>
              <label>
                Categoría
                <input
                  name="category"
                  defaultValue={editing.category}
                  maxLength="60"
                  required
                />
              </label>
              <label>
                Color de la ilustración
                <select name="color" defaultValue={editing.color}>
                  {['terracotta', 'sage', 'sand'].map((c) => (
                    <option key={c} value={c}>
                      {
                        {
                          terracotta: 'Terracota',
                          sage: 'Verde salvia',
                          sand: 'Arena',
                        }[c]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Precio en pesos argentinos
                <input
                  name="price"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  defaultValue={editing.priceCents / 100}
                  required
                />
              </label>
              <div className="dimension-fields">
                {[
                  ['width', 'Ancho'],
                  ['height', 'Alto'],
                  ['depth', 'Profundidad'],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label} (cm)
                    <input
                      name={key}
                      type="number"
                      min="0.01"
                      max="200"
                      step="0.01"
                      defaultValue={
                        Number.isFinite(editing.dimensions?.[key])
                          ? Math.round(editing.dimensions[key] * 10) / 100
                          : ''
                      }
                      required={key === 'height'}
                      placeholder="A confirmar"
                    />
                  </label>
                ))}
              </div>
              <label className="checkbox">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={editing.active}
                />
                Visible en el catálogo
              </label>
              <p className="small">
                Guardá el producto y luego agregá su foto desde la tarjeta de
                abajo.
              </p>
              <button className="primary" disabled={busy}>
                Guardar producto
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
            </form>
          )}
          <p>
            {productPage.total} productos · Página {productPage.page} de{' '}
            {productPage.pages}
          </p>
          <div className="admin-products">
            {products.map((p) => (
              <article className="order" key={p._id}>
                <h3>{p.name}</h3>
                <ProductModel
                  product={p}
                  onPreview={onPreview}
                  onSaved={async () => {
                    setNotice('Modelo 3D guardado.');
                    await Promise.all([load(data.page), onCatalogChange()]);
                  }}
                />
                <ProductGalleryEditor
                  product={p}
                  onUpdated={async () => {
                    setNotice('Foto de la ficha guardada.');
                    await Promise.all([load(data.page), onCatalogChange()]);
                  }}
                />
                <ProductPhoto
                  product={p}
                  onSaved={async () => {
                    setNotice('Foto guardada.');
                    await Promise.all([load(data.page), onCatalogChange()]);
                  }}
                />
                <p>
                  {p.active ? 'Publicado' : 'Oculto'} ·{' '}
                  {formatMoney(p.priceCents, p.currency)}
                </p>
                <button className="outline" onClick={() => setEditing(p)}>
                  Editar {p.name}
                </button>
                <button
                  className="outline danger"
                  onClick={() => deleteProduct(p._id)}
                  disabled={busy}
                >
                  Eliminar {p.name}
                </button>
              </article>
            ))}
          </div>
          <Pagination
            page={productPage.page}
            pages={productPage.pages}
            busy={busy || loading}
            onPage={(page) =>
              load(data.page, page).catch((e) => setError(e.message))
            }
          />
        </>
      )}
    </section>
  );
}
