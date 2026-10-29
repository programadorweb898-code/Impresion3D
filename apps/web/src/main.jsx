import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSchema, loginSchema } from '@impresion3d/shared';
import './styles.css';
import { api } from './api.js';
import { Admin } from './Admin.jsx';
const money = (c, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(c / 100);
function Modal({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal">{children}</div>
    </dialog>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [products, setProducts] = useState([]),
    [orders, setOrders] = useState([]),
    [view, setView] = useState('catalog'),
    [auth, setAuth] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [category, setCategory] = useState('Todos'),
    [selected, setSelected] = useState(null);
  useEffect(() => {
    api('/products')
      .then(setProducts)
      .catch(() =>
        setError(
          'No pudimos cargar el catálogo. Comprobá que la API esté disponible.',
        ),
      )
      .finally(() => setLoading(false));
    api('/auth/me')
      .then(setUser)
      .catch(() => {});
  }, []);
  async function history() {
    setView('orders');
    setError('');
    try {
      setOrders(await api('/orders'));
    } catch (e) {
      setError(e.message);
    }
  }
  async function submitAuth(event) {
    event.preventDefault();
    setError('');
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (
      auth === 'register' ? registerSchema : loginSchema
    ).safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      setUser(
        await api('/auth/' + auth, {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        }),
      );
      setAuth(null);
      setNotice('Ya podés solicitar tus productos y consultar tus pedidos.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submitOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          productId: selected._id,
          quantity: Number(values.quantity),
          notes: values.notes,
        }),
      });
      setSelected(null);
      setNotice(
        'Solicitud recibida. Confirmaremos disponibilidad y fecha de entrega.',
      );
      await history();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <a className="brand" href="#" onClick={() => setView('catalog')}>
          <span className="brand-icon">✳</span> impresión
          <span className="text-orange-600">3D</span>
        </a>
        <nav aria-label="Principal">
          <button onClick={() => setView('catalog')}>Catálogo</button>
          <a href="#proceso" onClick={() => setView('catalog')}>
            Cómo funciona
          </a>
          {user ? (
            <>
              <button onClick={history}>Mis pedidos</button>
              {user.role === 'admin' && (
                <button onClick={() => setView('admin')}>Administración</button>
              )}
              <button
                onClick={async () => {
                  try {
                    await api('/auth/logout', { method: 'POST' });
                    setUser(null);
                    setOrders([]);
                    setView('catalog');
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <button
              className="outline"
              onClick={() => {
                setError('');
                setAuth('login');
              }}
            >
              Ingresar ↗
            </button>
          )}
        </nav>
      </header>
      <main>
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button aria-label="Cerrar aviso" onClick={() => setNotice('')}>
              ×
            </button>
          </div>
        )}
        {error && !auth && !selected && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {view === 'admin' && user?.role === 'admin' ? (
          <Admin onCatalogChange={() => api('/products').then(setProducts)} />
        ) : view === 'catalog' ? (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">
                  DISEÑADO CON INTENCIÓN · IMPRESO EN 3D
                </p>
                <h1>
                  De una idea,
                  <br />a tu <em>mundo.</em>
                </h1>
                <p className="hero-copy">
                  Objetos que hacen tu día un poco más tuyo. Descubrí diseños
                  únicos y contanos cómo los imaginás.
                </p>
                <a className="primary" href="#catalogo">
                  Explorar diseños <span>↗</span>
                </a>
                <p className="small mt-6">
                  Hecho por encargo · Atención personal · Sin pagos online
                </p>
              </div>
              <div
                className="hero-art"
                aria-label="Ilustración de una maceta geométrica"
              >
                <div className="orb" />
                <div className="vase">
                  <div />
                </div>
                <span className="art-label">DE LA PANTALLA A TUS MANOS</span>
                <span className="art-number">
                  01 / OBJETOS CON PERSONALIDAD
                </span>
              </div>
            </section>
            <section id="catalogo" className="catalog">
              <div className="section-top">
                <div>
                  <p className="eyebrow">PEQUEÑOS DETALLES, GRANDES IDEAS</p>
                  <h2>Encontrá tu próxima pieza.</h2>
                </div>
                <span className="small">Hechas a pedido, para vos.</span>
              </div>
              <div className="filters" aria-label="Filtrar productos">
                {[
                  'Todos',
                  ...new Set(products.map((p) => p.category).filter(Boolean)),
                ].map((c) => (
                  <button
                    key={c}
                    aria-pressed={category === c}
                    className={category === c ? 'active' : ''}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {loading ? (
                <p role="status">Cargando diseños…</p>
              ) : !products.length ? (
                <div className="empty">
                  Estamos preparando nuestros primeros diseños. Volvé pronto.
                </div>
              ) : (
                <div className="grid-products">
                  {products
                    .filter(
                      (p) => category === 'Todos' || p.category === category,
                    )
                    .map((p, i) => (
                      <article key={p._id}>
                        <div className={'product-art color-' + p.color}>
                          {p.image?.url ? (
                            <img
                              className="product-photo"
                              src={p.image.url}
                              alt={p.name}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <>
                              <span className="piece-number">
                                PIEZA / {String(i + 1).padStart(2, '0')}
                              </span>
                              <div
                                className={'object object-' + (i % 3)}
                                aria-hidden="true"
                              />
                              <span className="small">
                                Ilustración conceptual
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex justify-between items-start gap-4 mt-5">
                          <div>
                            <p className="small uppercase">{p.category}</p>
                            <h3>{p.name}</h3>
                          </div>
                          <strong>{money(p.priceCents, p.currency)}</strong>
                        </div>
                        <p className="description">{p.description}</p>
                        <p className="small">
                          {p.dimensions?.width} × {p.dimensions?.height} ×{' '}
                          {p.dimensions?.depth} mm
                        </p>
                        <button
                          className="product-button"
                          onClick={() => {
                            setError('');
                            if (!user) {
                              setAuth('login');
                              setNotice('Ingresá para solicitar tu pedido.');
                            } else setSelected(p);
                          }}
                        >
                          Solicitar pieza <span>↗</span>
                        </button>
                      </article>
                    ))}
                </div>
              )}
            </section>
            <section id="proceso" className="process">
              <div>
                <p className="eyebrow">ASÍ DE SIMPLE</p>
                <h2>
                  Tu próxima idea
                  <br />
                  empieza acá.
                </h2>
              </div>
              {[
                [
                  '01',
                  'Elegí tu diseño',
                  'Explorá las piezas del catálogo y elegí tu favorita.',
                ],
                [
                  '02',
                  'Envianos tu solicitud',
                  'Registrate y contanos los detalles. Confirmamos disponibilidad y entrega.',
                ],
                [
                  '03',
                  'Seguí tu pedido',
                  'Consultá su estado desde tu cuenta. Coordinamos el pago y la entrega personalmente.',
                ],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <span className="step">{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </section>
            <section className="coming">
              <span>PRÓXIMAMENTE</span>
              <h2>Más espacio para tu imaginación.</h2>
              <p>
                Estamos preparando la personalización de medidas y, más
                adelante, la generación de modelos desde imágenes.
              </p>
            </section>
          </>
        ) : (
          <section className="orders">
            <p className="eyebrow">TU CUENTA · {user?.name}</p>
            <h1>Mis pedidos</h1>
            <p>
              La fecha de entrega se confirma después de revisar cada solicitud.
            </p>
            {orders.length ? (
              orders.map((o) => (
                <article className="order" key={o._id}>
                  <div className="flex justify-between flex-wrap gap-3">
                    <strong>Pedido #{o._id.slice(-6).toUpperCase()}</strong>
                    <span>{o.status.replaceAll('_', ' ')}</span>
                  </div>
                  <p>{new Date(o.createdAt).toLocaleDateString('es-AR')}</p>
                  {o.items.map((item, i) => (
                    <p key={i}>
                      {item.quantity} × {item.name}
                    </p>
                  ))}
                  <strong>{money(o.totalCents, o.currency)}</strong>
                  <p>
                    {o.estimatedReadyAt
                      ? 'Entrega estimada: ' +
                        new Date(o.estimatedReadyAt).toLocaleDateString('es-AR')
                      : 'Entrega pendiente de confirmación'}
                  </p>
                  <ol>
                    {o.history.map((h, i) => (
                      <li key={i}>
                        {h.status.replaceAll('_', ' ')} ·{' '}
                        {new Date(h.at).toLocaleString('es-AR')}
                        {h.estimatedReadyAt &&
                          ' · Entrega estimada: ' +
                            new Date(h.estimatedReadyAt).toLocaleDateString(
                              'es-AR',
                            )}
                      </li>
                    ))}
                  </ol>
                </article>
              ))
            ) : (
              <p className="empty">Todavía no tenés pedidos.</p>
            )}
          </section>
        )}
      </main>
      <footer>
        <a className="brand" href="#">
          ✳ impresión3D
        </a>
        <p>Ideas que toman forma.</p>
        <span className="small">Diseño local. Posibilidades infinitas.</span>
      </footer>
      {(auth || selected) && (
        <Modal
          onClose={() => {
            setAuth(null);
            setSelected(null);
            setError('');
          }}
        >
          <button
            className="close"
            aria-label="Cerrar"
            onClick={() => {
              setAuth(null);
              setSelected(null);
              setError('');
            }}
          >
            ×
          </button>
          <h2 id="modal-title">
            {selected
              ? 'Solicitar ' + selected.name
              : auth === 'register'
                ? 'Creá tu cuenta'
                : 'Qué bueno verte'}
          </h2>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {selected ? (
            <form onSubmit={submitOrder}>
              <p>
                Sin pago online. Revisaremos tu solicitud para confirmar la
                entrega.
              </p>
              <label>
                Cantidad
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max="20"
                  defaultValue="1"
                  required
                />
              </label>
              <label>
                Detalles de tu solicitud
                <textarea
                  name="notes"
                  maxLength="1000"
                  placeholder="Color preferido u otras consultas"
                />
              </label>
              <p>
                Precio por unidad:{' '}
                {money(selected.priceCents, selected.currency)}
              </p>
              <button className="primary" disabled={busy}>
                {busy ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitAuth}>
              {auth === 'register' && (
                <label>
                  Nombre
                  <input
                    name="name"
                    autoComplete="name"
                    minLength="2"
                    maxLength="80"
                    required
                  />
                </label>
              )}
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  minLength={auth === 'register' ? 12 : 1}
                  maxLength="128"
                  autoComplete={
                    auth === 'register' ? 'new-password' : 'current-password'
                  }
                  required
                />
              </label>
              {auth === 'register' && (
                <p className="small">Usá al menos 12 caracteres.</p>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? 'Procesando…'
                  : auth === 'register'
                    ? 'Crear cuenta'
                    : 'Ingresar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuth(auth === 'register' ? 'login' : 'register');
                  setError('');
                }}
              >
                {auth === 'register' ? 'Ya tengo cuenta' : 'Crear una cuenta'}
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById('root')).render(<App />);
