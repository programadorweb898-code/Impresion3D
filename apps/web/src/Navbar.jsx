import { useEffect, useLayoutEffect, useRef, useState } from 'react';
export function Navbar({
  user,
  cartCount,
  authReady,
  view,
  onCatalog,
  onCart,
  onOrders,
  onAdmin,
  onProfile,
  onLogin,
  onLogout,
  onHowItWorks,
  onDesign,
  cartButtonRef,
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef(null);
  const showingProcess = view === 'catalog' && location.hash === '#proceso';
  const headerRef = useRef(null);
  const spacerRef = useRef(null);
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 575.98px)').matches,
  );
  useLayoutEffect(() => {
    const header = headerRef.current;
    const root = document.documentElement;
    const previousHeight = root.style.getPropertyValue('--site-header-height');
    const resize = () => {
      const style = getComputedStyle(header);
      // Reserve only the top row: opening the mobile menu overlays content without moving it.
      const rowHeight = Math.max(
        header.querySelector('.brand').offsetHeight,
        header.querySelector('.header-actions').offsetHeight,
        mobile ? 0 : header.querySelector('.site-nav').offsetHeight,
      );
      const height =
        rowHeight +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth);
      spacerRef.current.style.height = height + 'px';
      root.style.setProperty('--site-header-height', height + 'px');
    };
    const observer = new ResizeObserver(resize);
    observer.observe(header);
    resize();
    return () => {
      observer.disconnect();
      if (previousHeight)
        root.style.setProperty('--site-header-height', previousHeight);
      else root.style.removeProperty('--site-header-height');
    };
  }, [mobile]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 576px)');
    const resize = () => {
      setMobile(!media.matches);
      if (media.matches) setExpanded(false);
    };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  const choose = (action) => {
    setExpanded(false);
    action();
  };
  return (
    <>
      <div className="site-header-spacer" ref={spacerRef} aria-hidden="true" />
      <header className="site-header" ref={headerRef}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            choose(onCatalog);
          }}
        >
          <span className="brand-icon">✳</span> Mundo{' '}
          <span className="text-orange-600">3D</span>
        </a>
        <div className={'nav-collapse' + (expanded ? ' is-expanded' : '')}>
          <nav
            inert={mobile && !expanded}
            id="site-navigation"
            className={'site-nav' + (expanded ? ' is-expanded' : '')}
            aria-label="Principal"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && expanded) {
                setExpanded(false);
                toggle.current?.focus();
              }
            }}
          >
            <button
              aria-current={
                (view === 'catalog' && !showingProcess) || view === 'product'
                  ? 'page'
                  : undefined
              }
              onClick={() => choose(onCatalog)}
            >
              Catálogo
            </button>
            <a
              href="/disenar"
              aria-current={view === 'design' ? 'page' : undefined}
              onClick={(event) => {
                if (
                  event.button === 0 &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  choose(onDesign);
                }
              }}
            >
              Subí tu diseño
            </a>
            <a
              href="/#proceso"
              aria-current={showingProcess ? 'location' : undefined}
              onClick={(event) => {
                if (
                  event.button === 0 &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  choose(onHowItWorks);
                }
              }}
            >
              Cómo funciona
            </a>
            {user ? (
              <>
                <button
                  aria-current={view === 'orders' ? 'page' : undefined}
                  onClick={() => choose(onOrders)}
                >
                  Mis pedidos
                </button>
                {user.role === 'admin' && (
                  <button
                    aria-current={view === 'admin' ? 'page' : undefined}
                    onClick={() => choose(onAdmin)}
                  >
                    Administración
                  </button>
                )}
                <a
                  className="profile-link"
                  href="/perfil"
                  aria-label="Mi perfil"
                  aria-current={view === 'profile' ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    choose(onProfile);
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="3.6" />
                    <path d="M4.5 20.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" />
                  </svg>
                  <span className="profile-label">Perfil</span>
                </a>
                <button className="nav-logout" onClick={() => choose(onLogout)}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <button className="outline" onClick={() => choose(onLogin)}>
                Ingresar
              </button>
            )}
          </nav>
        </div>
        <div className="header-actions">
          <button
            ref={cartButtonRef}
            className="cart-icon-button"
            type="button"
            onClick={() => choose(onCart)}
            disabled={!authReady}
            aria-label={'Abrir carrito, ' + cartCount + ' productos'}
            aria-haspopup={user ? 'dialog' : undefined}
          >
            <svg
              width="25"
              height="25"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3h2l2.4 12h11.2L21 7H6" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            {cartCount > 0 && (
              <span className="cart-badge" aria-hidden="true">
                {cartCount}
              </span>
            )}
          </button>
          <button
            className="menu-toggle"
            type="button"
            ref={toggle}
            aria-label={expanded ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={expanded}
            aria-controls="site-navigation"
            onClick={() => setExpanded((current) => !current)}
          >
            <svg
              width="25"
              height="25"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {expanded ? (
                <path d="m6 6 12 12M18 6 6 18" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>
    </>
  );
}
