import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  registerSchema,
  loginSchema,
  formatMoney as money,
} from '@impresion3d/shared';
import './styles.css';
import { api } from './api.js';
import { Cart } from './Cart.jsx';
import { useCart } from './useCart.js';
import {
  pendingCheckout,
  prepareCheckout,
  clearCheckout,
  completeCheckout,
} from './checkout-state.js';
import { AuthPage } from './AuthPage.jsx';
import { WhatsAppButton } from './WhatsAppButton.jsx';
import { Navbar } from './Navbar.jsx';
import { CartDrawer } from './CartDrawer.jsx';
import { Pagination } from './Pagination.jsx';
import { Profile } from './Profile.jsx';
import { Toast } from './Toast.jsx';
import { ProductDetails } from './ProductDetails.jsx';
import { BackLink } from './BackLink.jsx';
import { LegalPage } from './LegalPage.jsx';
import { legalPages, legalSite } from '@impresion3d/shared';
import {
  currentPage,
  catalogContext,
  rememberCatalog,
  initializeNavigation,
  navigatePage,
  returnToPreviousPage,
} from './navigation.js';
const Admin = lazy(() =>
  import('./Admin.jsx').then((module) => ({ default: module.Admin })),
);
const ProductViewer = lazy(() => import('./ProductViewer.jsx'));
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
    [catalogPage, setCatalogPage] = useState({
      page: catalogContext().page,
      pages: 1,
      categories: [],
    }),
    [orderPage, setOrderPage] = useState({ page: 1, pages: 1 }),
    [ordersLoading, setOrdersLoading] = useState(false),
    [cartCatalog, setCartCatalog] = useState({
      key: null,
      products: [],
      status: 'idle',
    }),
    [cartRefresh, setCartRefresh] = useState(0),
    [view, setView] = useState(() => currentPage().view),
    [detailId, setDetailId] = useState(() => currentPage().id),
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
    [cartOpen, setCartOpen] = useState(false),
    [logoutPrompt, setLogoutPrompt] = useState(false),
    [loggingOut, setLoggingOut] = useState(false),
    [logoutError, setLogoutError] = useState(''),
    [error, setError] = useState(''),
    [authMessage, setAuthMessage] = useState(''),
    [notice, setNotice] = useState(''),
    [cartToast, setCartToast] = useState(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [category, setCategory] = useState(() => catalogContext().category),
    [search, setSearch] = useState(''),
    [priceMin, setPriceMin] = useState(''),
    [priceMax, setPriceMax] = useState(''),
    [sort, setSort] = useState('relevance'),
    [cartNotes, setCartNotes] = useState(''),
    [viewing, setViewing] = useState(null),
    [navigationVersion, setNavigationVersion] = useState(0);
  const cart = useCart(user?.id);
  const [authReady, setAuthReady] = useState(false);
  const loginDestination = useRef(null);
  const toastSequence = useRef(0);
  const dismissCartToast = useCallback(() => setCartToast(null), []);
  useEffect(() => {
    if (!user?.id) return;
    try {
      setCartNotes(pendingCheckout(user.id)?.notes || '');
    } catch {
      setError(
        'No pudimos recuperar el envío pendiente. Revisá Mis pedidos antes de enviar.',
      );
    }
  }, [user?.id]);
  const cartButtonRef = useRef(null);
  const scrollTarget = useRef(location.hash.slice(1) || null);
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
  useLayoutEffect(() => {
    const target =
      scrollTarget.current && document.getElementById(scrollTarget.current);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    scrollTarget.current = null;
  }, [view, loginPage, detailId, navigationVersion]);
  const cartProductIds = new Set(cart.items.map((item) => item.productId));
  const cartIds = cart.items.map((item) => item.productId).join(',');
  const cartKey = JSON.stringify([user?.id, cartIds, cartRefresh]);
  const currentCartCatalog = cartCatalog.key === cartKey;
  const cartProducts = currentCartCatalog ? cartCatalog.products : [];
  const cartCatalogError = currentCartCatalog && cartCatalog.status === 'error';
  const refreshingCart =
    !currentCartCatalog || ['idle', 'loading'].includes(cartCatalog.status);
  useEffect(() => {
    if (!cartOpen || !cart.ready || !user?.id) return;
    let active = true;
    setCartCatalog((current) => ({
      key: cartKey,
      products: current.key === cartKey ? current.products : [],
      status: 'loading',
    }));
    const request = cartIds
      ? api('/products?ids=' + cartIds)
      : Promise.resolve([]);
    request
      .then((data) => {
        if (active)
          setCartCatalog({ key: cartKey, products: data, status: 'ready' });
      })
      .catch(() => {
        if (active)
          setCartCatalog({ key: cartKey, products: [], status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [cartOpen, cart.ready, user?.id, cartIds, cartKey]);
  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ page: String(catalogPage.page) });
    if (category !== 'Todos') query.set('category', category);
    if (search.trim().toLowerCase()) query.set('startsWith', search.trim().toLowerCase());
    if (priceMin !== '') query.set('priceMin', String(Math.round(Number(priceMin) * 100)));
    if (priceMax !== '') query.set('priceMax', String(Math.round(Number(priceMax) * 100)));
    if (sort !== 'relevance') query.set('sort', sort);
    if (search.trim().toLowerCase()) query.set('startsWith', search.trim().toLowerCase());
    if (priceMin !== '') query.set('priceMin', String(Math.round(Number(priceMin) * 100)));
    if (priceMax !== '') query.set('priceMax', String(Math.round(Number(priceMax) * 100)));
    if (sort !== 'relevance') query.set('sort', sort);
    api('/products?' + query)
      .then((data) => {
        if (!active) return;
        setProducts(data.products);
        setCatalogPage((current) => ({
          ...current,
          pages: data.pages,
          categories: data.categories,
        }));
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catalogPage.page, category, search, priceMin, priceMax, sort]);
  useEffect(() => {
    if (view === 'orders' && user?.id && !ordersLoading && !orders.length)
      history(orderPage.page);
  }, [view, user?.id]);
  async function reloadCatalog() {
    const query = new URLSearchParams({ page: String(catalogPage.page) });
    if (category !== 'Todos') query.set('category', category);
    const data = await api('/products?' + query);
    setProducts(data.products);
    setCatalogPage({
      page: data.page,
      pages: data.pages,
      categories: data.categories,
    });
  }
  useEffect(() => {
    initializeNavigation();
    const onNavigate = (event) => {
      if (
        event.type === 'popstate' &&
        currentPage().view === 'catalog' &&
        ['#proceso', '#catalogo'].includes(location.hash)
      ) {
        window.history.replaceState(
          window.history.state,
          '',
          location.pathname + location.search,
        );
      }
      scrollTarget.current = null;
      setNavigationVersion((current) => current + 1);
      const isLogin = location.pathname === '/login';
      setLoginPage(isLogin);
      setAuth(isLogin ? 'login' : null);
      setLoginPrompt(false);
      setCartOpen(false);
      const page = currentPage();
      setView(page.view);
      setDetailId(page.id);
      if (page.view === 'catalog') {
        const saved = catalogContext();
        setCategory(saved.category);
        setCatalogPage((current) => ({ ...current, page: saved.page }));
      }
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
    if (view === 'catalog') rememberCatalog(catalogPage.page, category);
    if (view === 'product' && !loginDestination.current)
      loginDestination.current = 'product';
    dismissCartToast();
    setCartOpen(false);
    setLoginPrompt(false);
    setError('');
    setNotice('');
    navigatePage('login', '/login');
    setLoginPage(true);
    setAuth('login');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
  }
  function closeAuth() {
    if (location.pathname === '/login')
      navigatePage('catalog', '/', { replace: true });
    setLoginPage(false);
    setAuth(null);
    setError('');
  }
  function showCatalog(options = {}) {
    closeAuth();
    loginDestination.current = null;
    setView('catalog');
    navigatePage('catalog', '/', { replace: options.replace === true });
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
  }
  useEffect(() => {
    if (location.pathname === '/perfil' && location.hash.startsWith('#email='))
      window.history.replaceState(window.history.state, '', '/perfil');
  }, [profileToken]);
  useEffect(() => {
    document.title = legalPages[view]
      ? legalPages[view].title + ' | ' + legalSite.name
      : legalSite.name + ' · Ideas que toman forma';
  }, [view]);
  function openSection(id) {
    if (view === 'catalog') rememberCatalog(catalogPage.page, category);
    navigatePage('catalog', '/#' + id);
    scrollTarget.current = id;
    setView('catalog');
    setError('');
    setNotice('');
    setNavigationVersion((current) => current + 1);
  }
  function requestLogout() {
    setLogoutError('');
    setLogoutPrompt(true);
  }
  function openLegal(key) {
    if (view === 'catalog') rememberCatalog(catalogPage.page, category);
    navigatePage(key, legalPages[key].path);
    setView(key);
    setError('');
    setNotice('');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
  }
  function openProduct(id, replace = false) {
    if (view === 'catalog') rememberCatalog(catalogPage.page, category);
    navigatePage('product', '/descripcion/' + encodeURIComponent(id), {
      replace,
    });
    setDetailId(id);
    setView('product');
    setError('');
    setNotice('');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
  }
  function goBack() {
    if (!returnToPreviousPage()) showCatalog({ replace: true });
  }
  function openAdmin() {
    if (view === 'catalog') rememberCatalog(catalogPage.page, category);
    navigatePage('admin', '/');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
    setView('admin');
    setError('');
  }
  function openProfile() {
    if (view === 'catalog') rememberCatalog(catalogPage.page, category);
    closeAuth();
    navigatePage('profile', '/perfil');
    setView('profile');
    setError('');
    setNotice('');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
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
      navigatePage('login', '/login', { replace: true });
      setLoginPage(true);
      setAuth('login');
      setAuthMessage('');
      setView('catalog');
      setDetailId(null);
      setCartOpen(false);
      setLoginPrompt(false);
      dismissCartToast();
      loginDestination.current = null;
      scrollTarget.current = null;
      setNavigationVersion((current) => current + 1);
      setNotice('');
      setError('');
      setLogoutPrompt(false);
    } catch (e) {
      setLogoutError(e.message);
    } finally {
      setLoggingOut(false);
    }
  }
  async function history(page = 1) {
    if (view === 'catalog') rememberCatalog(catalogPage.page, category);
    navigatePage('orders', '/');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
    setView('orders');
    setError('');
    setOrdersLoading(true);
    try {
      const data = await api('/orders?page=' + page);
      setOrders(data.orders);
      setOrderPage(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setOrdersLoading(false);
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
      const result = await api('/auth/' + auth, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      if (result.verificationRequired) {
        setAuth('login');
        setAuthMessage(result.message);
        return;
      }
      setUser(result);
      setAuthMessage('');
      closeAuth();
      setAuthReady(true);
      if (loginDestination.current === 'cart') {
        showCart();
      }
      if (loginDestination.current === 'profile') openProfile();
      if (loginDestination.current === 'product' && detailId)
        openProduct(detailId, true);
      loginDestination.current = null;
      setNotice('Ya podés armar tu carrito y consultar tus pedidos.');
    } catch (e) {
      // En el login usamos un mensaje genérico y no exponemos la referencia de la solicitud.
      setError(
        auth === 'login' && e.status === 401
          ? 'Usuario o contraseña incorrecta'
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  function refreshCart() {
    setCartRefresh((current) => current + 1);
  }
  function showCart() {
    refreshCart();
    setCartOpen(true);
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
    showCart();
    setError('');
  }
  function editCart(action) {
    if (busy || !user) return;
    try {
      action();
      setError('');
    } catch (e) {
      setNotice(e.message);
    }
  }
  function addToCart(product) {
    if (!authReady) return;
    if (!user) {
      loginDestination.current = view === 'product' ? 'product' : 'catalog';
      setError('');
      setNotice('');
      setLoginPrompt(true);
      return;
    }
    try {
      cart.add(product._id);
      setNotice('');
      setCartToast({
        id: ++toastSequence.current,
        message: 'Agregaste ' + product.name + ' al carrito.',
      });
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
    const byId = new Map(cartProducts.map((p) => [p._id, p]));
    if (cart.items.some((i) => !byId.has(i.productId))) {
      setError('Quitá los productos no disponibles antes de enviar.');
      return;
    }
    setBusy(true);
    let order;
    try {
      order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify(
          prepareCheckout(user.id, {
            items: cart.items.map((i) => ({
              ...i,
              expectedUnitPriceCents: byId.get(i.productId).priceCents,
            })),
            notes: cartNotes,
          }),
        ),
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
      if (['PRICE_CHANGED', 'PRODUCT_UNAVAILABLE'].includes(e.code)) {
        try {
          clearCheckout(user.id);
        } catch {
          setError(
            'No pudimos actualizar el intento de envío. Revisá el almacenamiento del sitio en tu navegador.',
          );
        }
      }
      if ([404, 409].includes(e.status)) refreshCart();
      setBusy(false);
      return;
    }
    // Persist the empty cart before releasing the key of a confirmed order.
    try {
      completeCheckout(user.id);
    } catch {
      /* Replaying the saved key remains safe. */
    }
    cart.clear();
    setCartNotes('');
    setOrders((current) => [
      order,
      ...current.filter((o) => o._id !== order._id),
    ]);
    setNotice(
      'Pedido #' +
        order._id.slice(-6).toUpperCase() +
        ' recibido. Coordinaremos disponibilidad, pago y entrega.',
    );
    setCartOpen(false);
    navigatePage('orders', '/');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
    setView('orders');
    try {
      const data = await api('/orders?page=1');
      setOrders(data.orders);
      setOrderPage(data);
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
        <Navbar
          cartButtonRef={cartButtonRef}
          user={user}
          cartCount={cart.items.length}
          authReady={authReady}
          view={view}
          onCatalog={showCatalog}
          onCart={openCart}
          onOrders={() => history()}
          onAdmin={openAdmin}
          onProfile={openProfile}
          onLogin={openLogin}
          onLogout={requestLogout}
          onHowItWorks={() => openSection('proceso')}
        />
      )}
      {(loginPage || view !== 'catalog') && (
        <BackLink onBack={goBack} disabled={busy || loggingOut} />
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
          {legalPages[view] ? (
            <LegalPage pageKey={view} />
          ) : view === 'product' ? (
            <ProductDetails
              id={detailId || ''}
              onAdd={addToCart}
              onContinue={showCatalog}
              inCart={cartProductIds.has(detailId)}
              authReady={authReady}
            />
          ) : view === 'profile' ? (
            authReady ? (
              <Profile
                user={user}
                onUser={setUser}
                onLogout={requestLogout}
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
          ) : view === 'admin' && user?.role === 'admin' ? (
            <Suspense fallback={<p role="status">Cargando administración…</p>}>
              <Admin onCatalogChange={reloadCatalog} onPreview={setViewing} />
            </Suspense>
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
                  <a
                    className="primary"
                    href="#catalogo"
                    onClick={(event) => {
                      if (
                        event.button === 0 &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey
                      ) {
                        event.preventDefault();
                        openSection('catalogo');
                      }
                    }}
                  >
                    Explorar diseños <span>↗</span>
                  </a>
                  <p className="small mt-6">
                    Hecho por encargo · Atención personal · Sin pagos online
                  </p>
                </div>
                <figure className="hero-art">
                  <p className="hero-art-heading">
                    01 / OBJETOS CON PERSONALIDAD
                  </p>
                  <img
                    className="hero-photo"
                    src="/images/hero-3d-studio.svg"
                    width="1000"
                    height="1000"
                    fetchPriority="high"
                    alt="Visualización realista de una maceta geométrica terracota con textura de impresión 3D"
                  />
                  <figcaption className="hero-art-caption">
                    De la pantalla a tus manos.
                  </figcaption>
                </figure>
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
                  {['Todos', ...catalogPage.categories].map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={category === c ? 'active' : ''}
                      onClick={() => {
                        setCategory(c);
                        setCatalogPage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <form className="catalog-search" onSubmit={(event) => { event.preventDefault(); setCatalogPage((current) => ({ ...current, page: 1 })); }}>
                  <label>Buscar productos<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setCatalogPage((current) => ({ ...current, page: 1 })); }} placeholder="Nombre o categoría" /></label>
                  <label>Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Más relevantes</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option></select></label>
                  <label>Rango de precio
                    <select aria-label="Rango de precio" value={Array.from({ length: 8 }, (_, i) => [String(i * 5000), String((i + 1) * 5000)]).some(([min, max]) => priceMin === min && priceMax === max) ? priceMin + ':' + priceMax : ''}
                      onChange={(event) => {
                        const [min, max] = event.target.value ? event.target.value.split(':') : ['', ''];
                        setPriceMin(min);
                        setPriceMax(max);
                        setCatalogPage((current) => ({ ...current, page: 1 }));
                      }}>
                      <option value="">Todos los precios / personalizado</option>
                      {Array.from({ length: 8 }, (_, i) => {
                        const min = i * 5000, max = (i + 1) * 5000;
                        return <option key={min} value={min + ':' + max}>$ {min.toLocaleString('es-AR')} – $ {max.toLocaleString('es-AR')}</option>;
                      })}
                    </select>
                  </label>
                  <label>Precio mínimo<input type="number" min="0" step="1" value={priceMin} onChange={(event) => { setPriceMin(event.target.value); setCatalogPage((current) => ({ ...current, page: 1 })); }} placeholder="Desde" /></label>
                  <label>Precio máximo<input type="number" min="0" step="1" value={priceMax} onChange={(event) => { setPriceMax(event.target.value); setCatalogPage((current) => ({ ...current, page: 1 })); }} placeholder="Hasta" /></label>
                </form>
                {loading ? (
                  <p role="status">Cargando diseños…</p>
                ) : !products.length ? (
                  <div className="empty" role="status">
                    <strong>Sin resultados</strong>
                    <p>No encontramos productos que coincidan con tu búsqueda y filtros.</p>
                    <button type="button" onClick={() => {
                      setSearch(''); setCategory('Todos'); setPriceMin(''); setPriceMax('');
                      setCatalogPage((current) => ({ ...current, page: 1 }));
                    }}>Limpiar filtros</button>
                  </div>
                ) : (
                  <div className="grid-products">
                    {products.map((p, i) => (
                      <article
                        className="product-card"
                        key={p._id}
                        aria-labelledby={'product-' + p._id}
                      >
                        <a
                          className={
                            'product-art product-image-link color-' + p.color
                          }
                          href={'/descripcion/' + p._id}
                          aria-label={'Ver detalles de ' + p.name}
                          onClick={(event) => {
                            if (
                              event.button === 0 &&
                              !event.metaKey &&
                              !event.ctrlKey &&
                              !event.shiftKey &&
                              !event.altKey
                            ) {
                              event.preventDefault();
                              openProduct(p._id);
                            }
                          }}
                        >
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
                        </a>
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
                <Pagination
                  page={catalogPage.page}
                  pages={catalogPage.pages}
                  busy={loading}
                  onPage={(page) =>
                    setCatalogPage((current) => ({ ...current, page }))
                  }
                />
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
              {ordersLoading ? (
                <p role="status">Cargando pedidos…</p>
              ) : orders.length ? (
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
              <Pagination
                page={orderPage.page}
                pages={orderPage.pages}
                busy={ordersLoading}
                onPage={history}
              />
            </section>
          )}
        </main>
      )}
      {!loginPage && (
        <footer>
          <a className="brand" href="#" onClick={showCatalog}>
            ✳ Mundo 3D
          </a>
          <p>Ideas que toman forma.</p>
          <div className="footer-legal">
            <span className="small">
              Diseño local. Posibilidades infinitas.
            </span>
            {Object.entries(legalPages).map(([key, page]) => (
              <a
                key={key}
                href={page.path}
                aria-current={view === key ? 'page' : undefined}
                onClick={(event) => {
                  if (
                    event.button === 0 &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey
                  ) {
                    event.preventDefault();
                    openLegal(key);
                  }
                }}
              >
                {page.title}
              </a>
            ))}
            <a href={'mailto:' + legalSite.email}>{legalSite.email}</a>
          </div>
        </footer>
      )}
      {user && !loginPage && (
        <CartDrawer
          open={cartOpen}
          returnFocusRef={cartButtonRef}
          busy={busy}
          error={error}
          onClose={() => setCartOpen(false)}
        >
          <Cart
            items={cart.items}
            products={cartProducts}
            user={user}
            notes={cartNotes}
            onNotes={(value) => {
              setCartNotes(value);
            }}
            onQuantity={(id, q) => editCart(() => cart.quantity(id, q))}
            onRemove={(id) => editCart(() => cart.remove(id))}
            onClear={() => editCart(() => cart.clear())}
            onSubmit={submitOrder}
            onRefresh={refreshCart}
            onContinue={() => {
              setCartOpen(false);
              showCatalog();
            }}
            busy={busy || !cart.ready}
            refreshing={refreshingCart}
            catalogError={cartCatalogError}
          />
        </CartDrawer>
      )}
      {!loginPage && <WhatsAppButton phone="5491155606321" />}
      {!loginPage && cartToast && (
        <Toast
          key={cartToast.id}
          message={cartToast.message}
          onDismiss={dismissCartToast}
        />
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
          accountMessage={authMessage}
          clearError={() => {
            setError('');
            setAuthMessage('');
          }}
          busy={busy}
        />
      )}
    </>
  );
}
createRoot(document.getElementById('root')).render(<App />);
