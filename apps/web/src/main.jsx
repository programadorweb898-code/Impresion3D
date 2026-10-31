import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSchema, loginSchema } from '@impresion3d/shared';
import './styles.css';
import { api } from './api.js';
import { Admin } from './Admin.jsx';
import { Cart } from './Cart.jsx';
import { useCart } from './useCart.js';
import { AuthPage } from './AuthPage.jsx';
import { Profile } from './Profile.jsx';
const ProductViewer = lazy(() => import('./ProductViewer.jsx'));
const money = (c, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(c / 100);
function Modal({ children, onClose, wide = false }) {
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
      <div className={wide ? 'modal model-modal' : 'modal'}>{children}</div>
    </dialog>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [products, setProducts] = useState([]),
    [orders, setOrders] = useState([]),
    [view, setView] = useState(() =>
      location.pathname === '/perfil' ? 'profile' : 'catalog',
    ),
    [profileToken, setProfileToken] = useState(() =>
      location.pathname === '/perfil'
        ? new URLSearchParams(location.hash.slice(1)).get('email') || ''
        : '',
    ),
    [auth, setAuth] = useState(() =>
      location.pathname === '/login' ? 'login' : null,
    ),
    [loginPage, setLoginPage] = useState(() => location.pathname === '/login'),
    [loginPrompt, setLoginPrompt] = useState(false),
    [logoutPrompt, setLogoutPrompt] = useState(false),
    [loggingOut, setLoggingOut] = useState(false),
    [logoutError, setLogoutError] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [category, setCategory] = useState('Todos'),
    [cartNotes, setCartNotes] = useState(''),
    [refreshingCart, setRefreshingCart] = useState(false),
    [cartCatalogError, setCartCatalogError] = useState(false),
    [viewing, setViewing] = useState(null);
  const cart = useCart(user?.id);
  const [authReady, setAuthReady] = useState(false);
  const loginDestination = useRef(null);
  const checkoutId = useRef(null);
  const cartProductIds = new Set(cart.items.map((item) => item.productId));
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
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    const onNavigate = () => {
      const isLogin = location.pathname === '/login';
      setLoginPage(isLogin);
      setAuth(isLogin ? 'login' : null);
      setLoginPrompt(false);
      setView(location.pathname === '/perfil' ? 'profile' : 'catalog');
      const emailToken =
        location.pathname === '/perfil' &&
        new URLSearchParams(location.hash.slice(1)).get('email');
      if (emailToken) setProfileToken(emailToken);
      setError('');
    };
    window.addEventListener('popstate', onNavigate);
    window.addEventListener('hashchange', onNavigate);
    return () => {
      window.removeEventListener('popstate', onNavigate);
      window.removeEventListener('hashchange', onNavigate);
    };
  }, []);
  function openLogin() {
    setLoginPrompt(false);
    setError('');
    setNotice('');
    if (location.pathname !== '/login')
      window.history.pushState(null, '', '/login');
    setLoginPage(true);
    setAuth('login');
    window.scrollTo(0, 0);
  }
  function closeAuth() {
    if (location.pathname === '/login')
      window.history.replaceState(null, '', '/');
    setLoginPage(false);
    setAuth(null);
    setError('');
  }
  function showCatalog() {
    closeAuth();
    loginDestination.current = null;
    setView('catalog');
    if (location.pathname === '/perfil')
      window.history.pushState(null, '', '/');
  }
  useEffect(() => {
    if (location.pathname === '/perfil' && location.hash.startsWith('#email='))
      window.history.replaceState(null, '', '/perfil');
  }, [profileToken]);
  function openProfile() {
    closeAuth();
    if (location.pathname !== '/perfil')
      window.history.pushState(null, '', '/perfil');
    setView('profile');
    setError('');
    setNotice('');
    window.scrollTo(0, 0);
  }
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setCartNotes('');
      setOrders([]);
      setProfileToken('');
      checkoutId.current = null;
      window.history.replaceState(null, '', '/');
      setView('catalog');
      setNotice('Cerraste sesión.');
      setError('');
      setLogoutPrompt(false);
    } catch (e) {
      setLogoutError(e.message);
    } finally {
      setLoggingOut(false);
    }
  }
  async function history() {
    if (location.pathname === '/perfil')
      window.history.pushState(null, '', '/');
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
      closeAuth();
      setAuthReady(true);
      if (loginDestination.current === 'cart') {
        setView('cart');
        await refreshCart();
      }
      if (loginDestination.current === 'profile') openProfile();
      loginDestination.current = null;
      setNotice('Ya podés armar tu carrito y consultar tus pedidos.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshCart() {
    setRefreshingCart(true);
    setCartCatalogError(false);
    try {
      setProducts(await api('/products'));
    } catch {
      setCartCatalogError(true);
    } finally {
      setRefreshingCart(false);
    }
  }
  async function openCart() {
    if (!authReady) return;
    if (!user) {
      loginDestination.current = 'cart';
      setError('');
      openLogin();
      setNotice('Ingresá para armar tu carrito.');
      return;
    }
    if (location.pathname === '/perfil')
      window.history.pushState(null, '', '/');
    setView('cart');
    setError('');
    await refreshCart();
  }
  function editCart(action) {
    if (busy || !user) return;
    try {
      action();
      checkoutId.current = null;
      setError('');
    } catch (e) {
      setNotice(e.message);
    }
  }
  function addToCart(product) {
    if (!authReady) return;
    if (!user) {
      loginDestination.current = 'catalog';
      setError('');
      setNotice('');
      setLoginPrompt(true);
      return;
    }
    try {
      cart.add(product._id);
      checkoutId.current = null;
      setNotice('Agregaste ' + product.name + ' al carrito.');
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function submitOrder(event) {
    event.preventDefault();
    setError('');
    if (!user) {
      openLogin();
      return;
    }
    if (busy || refreshingCart || cartCatalogError || !cart.items.length)
      return;
    const byId = new Map(products.map((p) => [p._id, p]));
    if (cart.items.some((i) => !byId.has(i.productId))) {
      setError('Quitá los productos no disponibles antes de enviar.');
      return;
    }
    setBusy(true);
    let order;
    try {
      checkoutId.current ||= crypto.randomUUID();
      order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.items.map((i) => ({
            ...i,
            expectedUnitPriceCents: byId.get(i.productId).priceCents,
          })),
          notes: cartNotes,
          requestId: checkoutId.current,
        }),
      });
    } catch (e) {
      setError(e.message);
      if (e.status === 401) {
        setUser(null);
        openLogin();
        setView('catalog');
        loginDestination.current = 'cart';
        setError(
          'Tu sesión venció. Ingresá para recuperar tu carrito y enviar el pedido.',
        );
      }
      if ([404, 409].includes(e.status)) await refreshCart();
      setBusy(false);
      return;
    }
    cart.clear();
    setCartNotes('');
    checkoutId.current = null;
    setOrders((current) => [
      order,
      ...current.filter((o) => o._id !== order._id),
    ]);
    setNotice(
      'Pedido #' +
        order._id.slice(-6).toUpperCase() +
        ' recibido. Coordinaremos disponibilidad, pago y entrega.',
    );
    setView('orders');
    try {
      setOrders(await api('/orders'));
    } catch {
      setError(
        'Tu pedido se guardó, pero no pudimos actualizar el historial. Volvé a entrar en Mis pedidos para consultarlo.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!loginPage && (
        <header>
          <a className="brand" href="#" onClick={showCatalog}>
            <span className="brand-icon">✳</span> impresión
            <span className="text-orange-600">3D</span>
          </a>
          <nav aria-label="Principal">
            <button onClick={showCatalog}>Catálogo</button>
            <button
              className="cart-link"
              onClick={openCart}
              disabled={!authReady}
            >
              Carrito ({cart.count})
            </button>
            <a href="#proceso" onClick={showCatalog}>
              Cómo funciona
            </a>
            {user ? (
              <>
                <button onClick={history}>Mis pedidos</button>
                {user.role === 'admin' && (
                  <button
                    onClick={() => {
                      showCatalog();
                      setView('admin');
                    }}
                  >
                    Administración
                  </button>
                )}
                <a
                  className="profile-link"
                  href="/perfil"
                  aria-current={view === 'profile' ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    openProfile();
                  }}
                >
                  <span aria-hidden="true">◉</span> Mi perfil
                </a>
              </>
            ) : (
              <button
                className="outline"
                onClick={() => {
                  setError('');
                  openLogin();
                }}
              >
                Ingresar ↗
              </button>
            )}
          </nav>
        </header>
      )}
      {!loginPage && (
        <main>
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button aria-label="Cerrar aviso" onClick={() => setNotice('')}>
                ×
              </button>
            </div>
          )}
          {error && !auth && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {view === 'profile' ? (
            authReady ? (
              <Profile
                user={user}
                onUser={setUser}
                onLogout={() => {
                  setLogoutError('');
                  setLogoutPrompt(true);
                }}
                onLogin={() => {
                  loginDestination.current = 'profile';
                  openLogin();
                }}
                confirmationToken={profileToken}
                onConfirmed={() => setProfileToken('')}
              />
            ) : (
              <p role="status" className="profile-page">
                Comprobando tu sesión…
              </p>
            )
          ) : view === 'cart' && user ? (
            <Cart
              items={cart.items}
              products={products}
              user={user}
              notes={cartNotes}
              onNotes={(value) => {
                setCartNotes(value);
                checkoutId.current = null;
              }}
              onQuantity={(id, q) => editCart(() => cart.quantity(id, q))}
              onRemove={(id) => editCart(() => cart.remove(id))}
              onClear={() => editCart(() => cart.clear())}
              onSubmit={submitOrder}
              onRefresh={refreshCart}
              onContinue={() => setView('catalog')}
              busy={busy || !cart.ready}
              refreshing={refreshingCart}
              catalogError={cartCatalogError}
            />
          ) : view === 'admin' && user?.role === 'admin' ? (
            <Admin
              onCatalogChange={() => api('/products').then(setProducts)}
              onPreview={setViewing}
            />
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
                        <article
                          className="product-card"
                          key={p._id}
                          aria-labelledby={'product-' + p._id}
                        >
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
                              <h3 id={'product-' + p._id}>{p.name}</h3>
                            </div>
                            <strong>{money(p.priceCents, p.currency)}</strong>
                          </div>
                          <p className="description">{p.description}</p>
                          <p className="small">
                            {p.dimensions?.width} × {p.dimensions?.height} ×{' '}
                            {p.dimensions?.depth} mm
                          </p>
                          <div className="card-actions">
                            <button
                              className="model-button"
                              disabled={!p.model?.url}
                              onClick={() => setViewing(p)}
                            >
                              Ver en 3D <span aria-hidden="true">◇</span>
                            </button>
                            <button
                              className="product-button"
                              disabled={!authReady || cartProductIds.has(p._id)}
                              onClick={() => addToCart(p)}
                            >
                              {cartProductIds.has(p._id)
                                ? 'En el carrito'
                                : 'Agregar al carrito'}{' '}
                              <span aria-hidden="true">
                                {cartProductIds.has(p._id) ? '✓' : '＋'}
                              </span>
                            </button>
                          </div>
                          <p className="card-help">
                            {!p.model?.url
                              ? 'Vista 3D todavía no disponible.'
                              : cartProductIds.has(p._id)
                                ? 'Cambiá la cantidad desde tu carrito.'
                                : 'Giralo y acercalo en el visor.'}
                          </p>
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
                    'Agregá tus piezas al carrito, ingresá y envianos un único pedido.',
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
                La fecha de entrega se confirma después de revisar cada
                solicitud.
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
                          new Date(o.estimatedReadyAt).toLocaleDateString(
                            'es-AR',
                          )
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
      )}
      {!loginPage && (
        <footer>
          <a className="brand" href="#" onClick={showCatalog}>
            ✳ impresión3D
          </a>
          <p>Ideas que toman forma.</p>
          <span className="small">Diseño local. Posibilidades infinitas.</span>
        </footer>
      )}
      {viewing && (
        <Modal wide onClose={() => setViewing(null)}>
          <button
            className="close"
            aria-label="Cerrar visor 3D"
            onClick={() => setViewing(null)}
          >
            ×
          </button>
          <h2 id="modal-title">{viewing.name} · Vista 3D</h2>
          <Suspense fallback={<p role="status">Preparando visor…</p>}>
            <ProductViewer product={viewing} />
          </Suspense>
        </Modal>
      )}
      {logoutPrompt && (
        <Modal
          onClose={() => {
            if (!loggingOut) setLogoutPrompt(false);
          }}
        >
          <div className="login-prompt">
            <span className="login-prompt-icon" aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 5H5v14h4M14 8l4 4-4 4M9 12h9" />
              </svg>
            </span>
            <h2 id="modal-title">¿Querés cerrar sesión?</h2>
            <p>Podés cancelar para seguir navegando con tu cuenta.</p>
            {logoutError && (
              <p className="error" role="alert">
                {logoutError}
              </p>
            )}
            <div className="login-prompt-actions">
              <button
                className="primary"
                disabled={loggingOut}
                onClick={logout}
              >
                {loggingOut ? 'Saliendo…' : 'Salir'}
              </button>
              <button
                className="prompt-secondary"
                autoFocus
                disabled={loggingOut}
                onClick={() => setLogoutPrompt(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {loginPrompt && (
        <Modal onClose={() => setLoginPrompt(false)}>
          <div className="login-prompt">
            <span className="login-prompt-icon" aria-hidden="true">
              ✳
            </span>
            <p className="eyebrow">TU PRÓXIMA IDEA EMPIEZA ACÁ</p>
            <h2 id="modal-title">Guardá tus favoritos en el carrito</h2>
            <p>
              Para agregar productos al carrito, iniciá sesión o creá una
              cuenta.
            </p>
            <div className="login-prompt-actions">
              <button className="primary" onClick={openLogin}>
                Crear cuenta o iniciar sesión
              </button>
              <button
                className="prompt-secondary"
                onClick={() => setLoginPrompt(false)}
              >
                Continuar explorando
              </button>
            </div>
          </div>
        </Modal>
      )}
      {auth && loginPage && (
        <AuthPage
          auth={auth}
          setAuth={setAuth}
          submitAuth={submitAuth}
          error={error}
          clearError={() => setError('')}
          busy={busy}
          onBack={showCatalog}
        />
      )}
    </>
  );
}
createRoot(document.getElementById('root')).render(<App />);
