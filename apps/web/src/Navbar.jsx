import { Brand } from './Brand.jsx';
import { internalLink } from './site-content.js';
import { useEffect, useRef, useState } from 'react';
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
  onAbout,
  onDesign,
  cartButtonRef,
  categories = [],
  category = 'Todos',
  onCategory,
  onFaq,
  search,
  onSearchChange,
  onSearchSubmit,
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef(null);
  const headerRef = useRef(null);
  const categoryButtonRef = useRef(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryPanelPosition, setCategoryPanelPosition] = useState({ left: 0, top: 0 });
  const showingProcess = view === 'catalog' && location.hash === '#proceso';
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 575.98px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(min-width: 576px)');
    const resize = () => {
      setMobile(!media.matches);
      if (media.matches) setExpanded(false);
      setCategoriesOpen(false);
    };
    resize();
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  const choose = (action) => {
    setExpanded(false);
    setCategoriesOpen(false);
    action();
  };
  useEffect(() => {
    if (!categoriesOpen) return;
    const closeOutside = (event) => {
      if (!headerRef.current?.contains(event.target)) setCategoriesOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        setCategoriesOpen(false);
        categoryButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [categoriesOpen]);
  const toggleCategories = () => {
    if (!mobile && headerRef.current && categoryButtonRef.current) {
      const header = headerRef.current.getBoundingClientRect();
      const button = categoryButtonRef.current.getBoundingClientRect();
      setCategoryPanelPosition({
        left: Math.max(12, Math.min(button.left - header.left, header.width - 286)),
        top: button.bottom - header.top + 8,
      });
    }
    setCategoriesOpen((open) => !open);
  };
  const categoryLinks = () => (
    <>
      {['Todos', ...categories].map((item) => (
        <a
          key={item}
          href={item === 'Todos' ? '/#catalogo' : '/?categoria=' + encodeURIComponent(item) + '#catalogo'}
          aria-current={category === item && !search ? 'page' : undefined}
          onClick={(event) => internalLink(event, () => choose(() => onCategory(item)))}
        >
          {item === 'Todos' ? 'Todos los productos' : item}
        </a>
      ))}
    </>
  );
  return (
    <header className="site-header" ref={headerRef}>
      <a
        className="brand"
        aria-label="Mundo 3D, inicio"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          choose(onCatalog);
        }}
      >
        <Brand />
      </a>
      <form
        className="header-product-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
      >
        <label className="sr-only" htmlFor="header-product-search">Buscar productos</label>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="10.8" cy="10.8" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          id="header-product-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar productos"
          autoComplete="off"
        />
        <button className="sr-only" type="submit">Buscar en catálogo</button>
      </form>
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
          <div className="nav-category-group">
            <button
              type="button"
              ref={categoryButtonRef}
              className="nav-category-trigger"
              aria-expanded={categoriesOpen}
              aria-controls={mobile ? 'nav-category-mobile' : 'nav-category-desktop'}
              onClick={toggleCategories}
            >
              Categorías <span className="nav-category-chevron" aria-hidden="true">⌄</span>
            </button>
            {mobile && categoriesOpen && (
              <div className="nav-category-mobile-list" id="nav-category-mobile">
                {categoryLinks()}
              </div>
            )}
          </div>
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
            Diseño personalizado
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
          <a
            href="/faq"
            aria-current={view === 'faq' ? 'page' : undefined}
            onClick={(event) => internalLink(event, () => choose(onFaq))}
          >
            FAQ
          </a>
          <a
            href="/sobre-nosotros"
            aria-current={view === 'about' ? 'page' : undefined}
            onClick={(event) => {
              if (
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                choose(onAbout);
              }
            }}
          >
            Sobre nosotros
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
                title="Perfil"
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
              </a>
            </>
          ) : (
            <button className="outline" onClick={() => choose(onLogin)}>
              Ingresar
            </button>
          )}
        </nav>
      </div>
      {!mobile && categoriesOpen && (
        <div
          className="nav-category-popover"
          id="nav-category-desktop"
          style={{ left: categoryPanelPosition.left, top: categoryPanelPosition.top }}
          role="group"
          aria-label="Elegir categoría"
        >
          {categoryLinks()}
        </div>
      )}
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
  );
}
