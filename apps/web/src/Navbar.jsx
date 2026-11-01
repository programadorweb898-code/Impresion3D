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
  cartButtonRef,
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef(null);
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
          <span className="brand-icon">✳</span> impresión
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
            <button onClick={() => choose(onCatalog)}>Catálogo</button>
            <a href="#proceso" onClick={() => choose(onCatalog)}>
              Cómo funciona
            </a>
            {user ? (
              <>
                <button onClick={() => choose(onOrders)}>Mis pedidos</button>
                {user.role === 'admin' && (
                  <button onClick={() => choose(onAdmin)}>
                    Administración
                  </button>
                )}
                <a
                  className="profile-link"
                  href="/perfil"
                  aria-current={view === 'profile' ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    choose(onProfile);
                  }}
                >
                  <span aria-hidden="true">◉</span> Mi perfil
                </a>
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
