import { OrderDelivery } from './OrderDelivery.jsx';
import { offerDefinitions, offerPath } from '@impresion3d/shared';
import { OfferDetails } from './OfferDetails.jsx';
import { Brand, BrandMark } from './Brand.jsx';
import { validationMessage } from '@impresion3d/shared';
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
import { OffersCarousel } from './OffersCarousel.jsx';
import { SiteFooter } from './SiteFooter.jsx';
import { InformationPage } from './InformationPage.jsx';
import { informationPages, siteContact } from './site-content.js';
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
  savedScrollPosition,
  rememberScrollPosition,
  traverseHistory,
} from './navigation.js';
const Admin = lazy(() =>
  import('./Admin.jsx').then((module) => ({ default: module.Admin })),
);
const ProductViewer = lazy(() => import('./ProductViewer.jsx'));
const PhotoQuoteForm = lazy(() => import('./PhotoQuoteForm.jsx'));
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
    [search, setSearch] = useState(() => catalogContext().search),
    [priceMin, setPriceMin] = useState(() => catalogContext().priceMin),
    [priceMax, setPriceMax] = useState(() => catalogContext().priceMax),
    [sort, setSort] = useState(() => catalogContext().sort),
    [loadedCatalogKey, setLoadedCatalogKey] = useState(null),
    [cartNotes, setCartNotes] = useState(''),
    [cartDelivery, setCartDelivery] = useState({
      method: 'shipping',
      streetAddress: '',
      city: '',
      postalCode: '',
    }),
    [viewing, setViewing] = useState(null),
    [navigationVersion, setNavigationVersion] = useState(0);
  const cart = useCart(user?.id);
  const [authReady, setAuthReady] = useState(false);
  const loginDestination = useRef(null);
  const offerDrafts = useRef({});
  const toastSequence = useRef(0);
  const dismissCartToast = useCallback(() => setCartToast(null), []);
  useEffect(() => {
    if (!user?.id) {
      setCartDelivery({
        method: 'shipping',
        streetAddress: '',
        city: '',
        postalCode: '',
      });
      return;
    }
    try {
      const pending = pendingCheckout(user.id);
      setCartNotes(pending?.notes || '');
      setCartDelivery(
        pending?.delivery?.method === 'shipping'
          ? pending.delivery
          : { method: 'shipping', streetAddress: '', city: '', postalCode: '' },
      );
    } catch {
      setError(
        'No pudimos recuperar el envío pendiente. Revisá Mis pedidos antes de enviar.',
      );
    }
  }, [user?.id]);
  const cartButtonRef = useRef(null);
  const catalogQueryKey = JSON.stringify([
    catalogPage.page,
    category,
    search,
    priceMin,
    priceMax,
    sort,
  ]);
  const scrollTarget = useRef(
    savedScrollPosition() || location.hash.slice(1) || null,
  );
  const lastHistoryUrl = useRef(null);
  function saveCatalogContext() {
    rememberCatalog(catalogPage.page, category, {
      search,
      priceMin,
      priceMax,
      sort,
    });
  }
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.addEventListener('pagehide', rememberScrollPosition);
    return () => {
      window.history.scrollRestoration = previous;
      window.removeEventListener('pagehide', rememberScrollPosition);
    };
  }, []);
  useLayoutEffect(() => {
    const target = scrollTarget.current;
    const html = document.documentElement;
    html.removeAttribute('data-scroll-restoring');
    if (target && typeof target === 'object') {
      let observer, timer;
      const restore = () => {
        if (
          scrollTarget.current !== target ||
          document.querySelector('main [data-page-loading]')
        )
          return;
        window.scrollTo({ left: target.x, top: target.y, behavior: 'instant' });
        scrollTarget.current = null;
        html.removeAttribute('data-scroll-restoring');
        observer?.disconnect();
        clearTimeout(timer);
      };
      html.setAttribute('data-scroll-restoring', '');
      restore();
      if (scrollTarget.current === target) {
        observer = new MutationObserver(restore);
        observer.observe(document.getElementById('root'), {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-page-loading'],
        });
        timer = setTimeout(() => {
          if (scrollTarget.current === target) {
            window.scrollTo({
              left: target.x,
              top: target.y,
              behavior: 'instant',
            });
            scrollTarget.current = null;
          }
          html.removeAttribute('data-scroll-restoring');
          observer.disconnect();
        }, 10000);
      }
      return () => {
        observer?.disconnect();
        clearTimeout(timer);
        html.removeAttribute('data-scroll-restoring');
      };
    }
    const element = target && document.getElementById(target);
    if (element)
      element.scrollIntoView({ behavior: 'instant', block: 'start' });
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    scrollTarget.current = null;
  }, [view, loginPage, detailId, navigationVersion]);
  const cartProductIds = new Set(cart.items.map((item) => item.productId));
  const cartIds = cart.items.map((item) => item.productId).join(',');
  const cartKey = JSON.stringify([user?.id, cart.items, cartRefresh]);
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
    const request = cart.items.some((i) => i.offer)
      ? api('/offers/cart/preview', {
          method: 'POST',
          body: JSON.stringify({ items: cart.items }),
        })
      : cartIds
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
    // Category tabs and text search share the same dynamic search endpoint.
    const searchTerm = search.trim() || (category === 'Todos' ? '' : category);
    if (searchTerm) query.set('startsWith', searchTerm.toLowerCase());
    if (priceMin !== '')
      query.set('priceMin', String(Math.round(Number(priceMin) * 100)));
    if (priceMax !== '')
      query.set('priceMax', String(Math.round(Number(priceMax) * 100)));
    if (sort !== 'relevance') query.set('sort', sort);
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        api('/products?' + query, { signal: controller.signal })
          .then((data) => {
            if (!active) return;
            setProducts(data.products);
            setLoadedCatalogKey(catalogQueryKey);
            setCatalogPage((current) => ({
              ...current,
              pages: data.pages,
              total: data.total,
              categories: data.categories,
            }));
          })
          .catch((e) => {
            if (active) {
              setError(e.message);
              setLoadedCatalogKey(catalogQueryKey);
            }
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      search || priceMin || priceMax ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [catalogPage.page, category, search, priceMin, priceMax, sort]);
  useEffect(() => {
    if (view === 'orders' && user?.id && !ordersLoading && !orders.length)
      history(orderPage.page);
  }, [view, user?.id]);
  async function reloadCatalog() {
    const query = new URLSearchParams({ page: String(catalogPage.page) });
    const searchTerm = search.trim() || (category === 'Todos' ? '' : category);
    if (searchTerm) query.set('startsWith', searchTerm.toLowerCase());
    if (priceMin !== '')
      query.set('priceMin', String(Math.round(Number(priceMin) * 100)));
    if (priceMax !== '')
      query.set('priceMax', String(Math.round(Number(priceMax) * 100)));
    if (sort !== 'relevance') query.set('sort', sort);
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
        event.type === 'hashchange' &&
        lastHistoryUrl.current === location.href
      )
        return;
      lastHistoryUrl.current = location.href;
      scrollTarget.current =
        event.type === 'popstate'
          ? traverseHistory()
          : ['#catalogo', '#proceso'].includes(location.hash)
            ? location.hash.slice(1)
            : null;
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
        setSearch(saved.search);
        setPriceMin(saved.priceMin);
        setPriceMax(saved.priceMax);
        setSort(saved.sort);
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
    if (view === 'catalog') saveCatalogContext();
    if (['product', 'offer'].includes(view) && !loginDestination.current)
      loginDestination.current = view;
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
    const page =
      legalPages[view] ||
      informationPages[view] ||
      (view === 'offer'
        ? { title: offerDefinitions[detailId]?.name || 'Oferta' }
        : null);
    document.title = page
      ? page.title + ' | ' + legalSite.name
      : legalSite.name + ' · Ideas que toman forma';
  }, [view, detailId]);
  function openSection(id) {
    if (view === 'catalog') saveCatalogContext();
    navigatePage('catalog', '/#' + id);
    scrollTarget.current = id;
    setView('catalog');
    setError('');
    setNotice('');
    setNavigationVersion((current) => current + 1);
  }
  function openInformation(key) {
    if (view === 'catalog') saveCatalogContext();
    closeAuth();
    navigatePage(key, informationPages[key].path);
    setView(key);
    setError('');
    setNotice('');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
  }
  function openCategory(nextCategory) {
    if (view === 'catalog') saveCatalogContext();
    closeAuth();
    const path =
      nextCategory === 'Todos'
        ? '/#catalogo'
        : '/?categoria=' + encodeURIComponent(nextCategory) + '#catalogo';
    navigatePage('catalog', path);
    setCategory(nextCategory);
    setSearch('');
    setPriceMin('');
    setPriceMax('');
    setSort('relevance');
    setCatalogPage((current) => ({ ...current, page: 1 }));
    rememberCatalog(1, nextCategory);
    setView('catalog');
    setError('');
    setNotice('');
    scrollTarget.current = 'catalogo';
    setNavigationVersion((current) => current + 1);
  }
  function requestLogout() {
    setLogoutError('');
    setLogoutPrompt(true);
  }
  function openDesign() {
    if (view === 'catalog') saveCatalogContext();
    navigatePage('design', '/disenar');
    setView('design');
    setError('');
    setNotice('');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
  }
  function openLegal(key) {
    if (view === 'catalog') saveCatalogContext();
    navigatePage(key, legalPages[key].path);
    setView(key);
    setError('');
    setNotice('');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
  }
  function openOffer(id, replace = false) {
    if (view === 'catalog') saveCatalogContext();
    navigatePage('offer', offerPath(id), { replace });
    setDetailId(id);
    setView('offer');
    setError('');
    setNotice('');
    setCartOpen(false);
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
  }
  function addOfferToCart(line, name) {
    if (!authReady) return;
    if (!user) {
      loginDestination.current = 'offer';
      setLoginPrompt(true);
      return;
    }
    try {
      cart.addOffer(line);
      setNotice('');
      setCartToast({
        id: ++toastSequence.current,
        message: 'Agregaste ' + name + ' al carrito.',
      });
    } catch (e) {
      setNotice(e.message);
    }
  }
  function openProduct(id, replace = false) {
    if (view === 'catalog') saveCatalogContext();
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
    if (view === 'catalog') saveCatalogContext();
    navigatePage('admin', '/');
    scrollTarget.current = null;
    setNavigationVersion((current) => current + 1);
    setView('admin');
    setError('');
  }
  function openProfile() {
    if (view === 'catalog') saveCatalogContext();
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
      offerDrafts.current = {};
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
    if (view === 'catalog') saveCatalogContext();
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
      setError(validationMessage(parsed.error.issues[0]));
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
      if (loginDestination.current === 'offer' && detailId)
        openOffer(detailId, true);
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
            delivery: cartDelivery,
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
        ' en espera. Coordinaremos disponibilidad, pago y entrega.',
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
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      {!loginPage && (
        <Navbar
          cartButtonRef={cartButtonRef}
          user={user}
          cartCount={cart.items.length}
          authReady={authReady}
          view={view}
          onCatalog={showCatalog}
          onDesign={openDesign}
          onCart={openCart}
          onOrders={() => history()}
          onAdmin={openAdmin}
          onProfile={openProfile}
          onLogin={openLogin}
          onLogout={requestLogout}
          onHowItWorks={() => openSection('proceso')}
          onAbout={() => openInformation('about')}
        />
      )}
      {(loginPage || view !== 'catalog') && (
        <BackLink onBack={goBack} disabled={busy || loggingOut} />
      )}
      {!loginPage && (
        <main
          id="contenido"
          className={view === 'catalog' ? 'storefront-dark' : undefined}
        >
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
          ) : informationPages[view] ? (
            <InformationPage
              pageKey={view}
              onDesign={openDesign}
              onCatalog={() => openCategory('Todos')}
            />
          ) : view === 'design' ? (
            <Suspense
              fallback={
                <p role="status" data-page-loading>
                  Cargando formulario de presupuesto…
                </p>
              }
            >
              <PhotoQuoteForm />
            </Suspense>
          ) : view === 'offer' ? (
            !authReady || (user && !cart.ready) ? (
              <p role="status" data-page-loading>
                Cargando oferta…
              </p>
            ) : (
              <OfferDetails
                key={detailId}
                id={detailId || ''}
                initial={
                  offerDrafts.current[detailId] ||
                  cart.items.find((i) => i.offer?.id === detailId)?.offer
                }
                onDraft={(draft) => {
                  offerDrafts.current[draft.id] = draft;
                }}
                onAdd={addOfferToCart}
                onContinue={showCatalog}
                authReady={authReady}
                inCart={cart.items.some((i) => i.offer?.id === detailId)}
              />
            )
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
              <p role="status" className="profile-page" data-page-loading>
                Comprobando tu sesión…
              </p>
            )
          ) : view === 'admin' && user?.role === 'admin' ? (
            <Suspense
              fallback={
                <p role="status" data-page-loading>
                  Cargando administración…
                </p>
              }
            >
              <Admin onCatalogChange={reloadCatalog} onPreview={setViewing} />
            </Suspense>
          ) : view === 'catalog' ? (
            <>
              <section
                className="custom-design-feature"
                aria-labelledby="custom-design-feature-title"
              >
                <div className="custom-design-feature__info">
                  <p className="custom-design-feature__kicker">
                    <span className="custom-design-feature__dot" aria-hidden="true" />
                    NOVEDAD · DISEÑO PERSONALIZADO
                  </p>
                  <h2 id="custom-design-feature-title">
                    ¿Tenés una idea? <span>Hagámosla en 3D.</span>
                  </h2>
                  <p>
                    Enviá una foto o imagen de referencia y contanos qué
                    necesitás. Analizamos si se puede imprimir y te respondemos
                    con un presupuesto por WhatsApp o email. Sin archivos 3D.
                  </p>
                </div>
                <div className="custom-design-feature__action">
                  <ol className="custom-design-feature__steps" aria-label="Cómo funciona">
                    <li><strong>01</strong> Subí una imagen</li>
                    <li><strong>02</strong> Contanos los detalles</li>
                    <li><strong>03</strong> Recibí tu presupuesto</li>
                  </ol>
                  <a
                    className="custom-design-feature__cta"
                    href="/disenar"
                    onClick={(event) => {
                      if (
                        event.button === 0 &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey
                      ) {
                        event.preventDefault();
                        openDesign();
                      }
                    }}
                  >
                    Solicitar diseño personalizado
                    <span aria-hidden="true">↗</span>
                  </a>
                  <p className="custom-design-feature__note">
                    Consulta sin compromiso de compra. Necesitás iniciar sesión
                    para enviarla.
                  </p>
                </div>
              </section>
              <section className="hero">
                <div>
                  <p className="eyebrow">DISEÑO QUE TOMA FORMA</p>
                  <h1>
                    Otra forma
                    <br />
                    de hacer <em>lo cotidiano.</em>
                  </h1>
                  <p className="hero-copy">
                    Piezas para ordenar, decorar y regalar. Elegí un diseño de
                    nuestro catálogo o traé tu propia idea: la imprimimos para
                    vos.
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
                    Explorar catálogo <span aria-hidden="true">↗</span>
                  </a>
                  <p className="small mt-6">
                    Hecho a pedido. Coordinamos pago y entrega con vos.
                  </p>
                </div>
                <figure className="hero-art hero-brand-art">
                  <img
                    className="hero-photo"
                    src="/images/sm3d-portada-1000.webp"
                    srcSet="/images/sm3d-portada-640.webp 640w, /images/sm3d-portada-1000.webp 1000w"
                    sizes="(max-width: 575px) 90vw, 45vw"
                    width="1024"
                    height="1024"
                    fetchPriority="high"
                    alt="Logo SomosMundo3D en plateado y violeta neón, con un cubo y una boquilla de impresión 3D"
                  />
                  <figcaption className="hero-art-caption">
                    <span>SomosMundo3D · Diseño e impresión 3D.</span>
                    <span className="hero-caption-category">IMPRESIÓN 3D</span>
                  </figcaption>
                </figure>
              </section>
              <OffersCarousel onOffer={openOffer} />
              <section
                className="px-[5%] py-8"
                aria-labelledby="makerworld-title"
              >
                <h2 id="makerworld-title">También publicamos en MakerWorld</h2>
                <p>
                  MakerWorld es una plataforma de diseños para imprimir en 3D.
                  Si encontraste un diseño que te gusta, podés enviarnos una imagen
                  de referencia para consultar un presupuesto de impresión.
                </p>
                <a
                  href="https://makerworld.com/es"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'underline' }}
                >
                  Ir a MakerWorld
                </a>
              </section>
              <section
                id="catalogo"
                className="catalog"
                data-page-loading={
                  catalogQueryKey !== loadedCatalogKey || undefined
                }
              >
                <div className="section-top">
                  <div>
                    <p className="eyebrow">LA COLECCIÓN</p>
                    <h2>
                      Diseños para tu mundo<span className="accent-dot">.</span>
                    </h2>
                  </div>
                  <span className="small">
                    Explorá los detalles. Elegí tu próxima pieza.
                  </span>
                </div>
                <div className="filters" aria-label="Filtrar productos">
                  {['Todos', ...catalogPage.categories].map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={category === c ? 'active' : ''}
                      onClick={() => openCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <form
                  className="catalog-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setCatalogPage((current) => ({ ...current, page: 1 }));
                  }}
                >
                  <label>
                    Buscar productos
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setCategory('Todos');
                        setCatalogPage((current) => ({ ...current, page: 1 }));
                      }}
                      placeholder="Nombre o categoría"
                    />
                  </label>
                  <label>
                    Ordenar por
                    <select
                      value={sort}
                      onChange={(event) => {
                        setSort(event.target.value);
                        setCatalogPage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      <option value="relevance">Más relevantes</option>
                      <option value="price-asc">Precio: menor a mayor</option>
                      <option value="price-desc">Precio: mayor a menor</option>
                    </select>
                  </label>
                  <details className="price-filters">
                    <summary>Filtrar por precio</summary>
                    <div className="price-fields">
                      <label>
                        Rango de precio
                        <select
                          aria-label="Rango de precio"
                          value={
                            Array.from({ length: 8 }, (_, i) => [
                              String(i * 5000),
                              String((i + 1) * 5000),
                            ]).some(
                              ([min, max]) =>
                                priceMin === min && priceMax === max,
                            )
                              ? priceMin + ':' + priceMax
                              : ''
                          }
                          onChange={(event) => {
                            const [min, max] = event.target.value
                              ? event.target.value.split(':')
                              : ['', ''];
                            setPriceMin(min);
                            setPriceMax(max);
                            setCatalogPage((current) => ({
                              ...current,
                              page: 1,
                            }));
                          }}
                        >
                          <option value="">
                            Todos los precios / personalizado
                          </option>
                          {Array.from({ length: 8 }, (_, i) => {
                            const min = i * 5000,
                              max = (i + 1) * 5000;
                            return (
                              <option key={min} value={min + ':' + max}>
                                $ {min.toLocaleString('es-AR')} – ${' '}
                                {max.toLocaleString('es-AR')}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <label>
                        Precio mínimo
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={priceMin}
                          onChange={(event) => {
                            setPriceMin(event.target.value);
                            setCatalogPage((current) => ({
                              ...current,
                              page: 1,
                            }));
                          }}
                          placeholder="Desde"
                        />
                      </label>
                      <label>
                        Precio máximo
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={priceMax}
                          onChange={(event) => {
                            setPriceMax(event.target.value);
                            setCatalogPage((current) => ({
                              ...current,
                              page: 1,
                            }));
                          }}
                          placeholder="Hasta"
                        />
                      </label>
                    </div>
                  </details>
                </form>
                <div className="catalog-feedback">
                  <p role="status" aria-live="polite">
                    {loading
                      ? 'Actualizando catálogo…'
                      : `${catalogPage.total ?? products.length} diseños encontrados`}
                  </p>
                  {(search || category !== 'Todos' || priceMin || priceMax) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setCategory('Todos');
                        setPriceMin('');
                        setPriceMax('');
                        setCatalogPage((current) => ({ ...current, page: 1 }));
                      }}
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
                {loading && !products.length ? (
                  <div className="catalog-loading" role="status">
                    <span>Cargando diseños…</span>
                    <div className="grid-products" aria-hidden="true">
                      {Array.from({ length: 4 }, (_, i) => (
                        <div className="product-skeleton" key={i}>
                          <div />
                          <span />
                          <span />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : !products.length ? (
                  <div className="empty" role="status">
                    <strong>Sin resultados</strong>
                    <p>
                      No encontramos productos que coincidan con tu búsqueda y
                      filtros.
                    </p>
                  </div>
                ) : (
                  <div className="grid-products" aria-busy={loading}>
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
                              width="600"
                              height="600"
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
                        <p className="description">
                          {p.shortDescription || p.name}
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
                              {cartProductIds.has(p._id) ? '✓' : '+'}
                            </span>
                          </button>
                        </div>
                        {cartProductIds.has(p._id) && (
                          <p className="card-help">
                            {!p.model?.url
                              ? 'Vista 3D todavía no disponible.'
                              : cartProductIds.has(p._id)
                                ? 'Cambiá la cantidad desde tu carrito.'
                                : 'Giralo y acercalo en el visor.'}
                          </p>
                        )}
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
                <div>
                  <p className="eyebrow">¿TENÉS UNA FOTO O UNA IDEA?</p>
                  <h2>Tu idea también tiene lugar acá.</h2>
                  <p>
                    Mandanos una imagen del producto que te gustaría imprimir y
                    contanos cómo lo imaginás. Evaluamos tu idea y te presupuestamos.
                  </p>
                </div>
                <a
                  className="primary"
                  href="/disenar"
                  onClick={(event) => {
                    if (
                      event.button === 0 &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey
                    ) {
                      event.preventDefault();
                      openDesign();
                    }
                  }}
                >
                  Pedir presupuesto <span aria-hidden="true">↗</span>
                </a>
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
                    <OrderDelivery delivery={o.delivery} />
                    <strong>
                      {o.delivery?.status === 'pending_quote'
                        ? 'Productos (sin envío): '
                        : 'Total: '}
                      {money(o.totalCents, o.currency)}
                    </strong>
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
        <SiteFooter
          categories={catalogPage.categories}
          view={view}
          onCatalog={showCatalog}
          onCategory={openCategory}
          onInformation={openInformation}
          onLegal={openLegal}
        />
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
            delivery={cartDelivery}
            onDelivery={setCartDelivery}
            onNotes={(value) => {
              setCartNotes(value);
            }}
            onQuantity={(id, q) => editCart(() => cart.quantity(id, q))}
            onRemove={(id) => editCart(() => cart.remove(id))}
            onOffer={openOffer}
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
      {!loginPage && <WhatsAppButton phone={siteContact.whatsapp} />}
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
              <BrandMark />
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
