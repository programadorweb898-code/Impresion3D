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
  const headerRef = useRef(null);
  const categoryButtonRef = useRef(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryPanelPosition, setCategoryPanelPosition] = useState({ left: 0, top: 0 });
  const showingProcess = view === 'catalog' && location.hash === '#proceso';

  const choose = (action) => {
    setCategoriesOpen(false);
    action();
  };

  useEffect(() => {
    if (!categoriesOpen) return;
    const closeOutside = (event) => {
      if (!event.target.closest?.('.nav-category-trigger, .nav-category-popover'))
        setCategoriesOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        setCategoriesOpen(false);
        categoryButtonRef.current?.focus();
      }
    };
    const closeOnResize = () => setCategoriesOpen(false);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [categoriesOpen]);

  const toggleCategories = () => {
    if (!categoriesOpen && headerRef.current && categoryButtonRef.current) {
      const header = headerRef.current.getBoundingClientRect();
      const trigger = categoryButtonRef.current.getBoundingClientRect();
      setCategoryPanelPosition({
        left: Math.max(8, Math.min(trigger.left - header.left, header.width - Math.min(286, header.width - 16) - 8)),
        top: trigger.bottom - header.top + 7,
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
          aria-current={category === item ? 'page' : undefined}
          onClick={(event) => internalLink(event, () => choose(() => onCategory(item)))}
        >
          {item === 'Todos' ? 'Todos los productos' : item}
        </a>
      ))}
    </>
  );

  return (
    <header className="site-header site-header-two-rows" ref={headerRef}>
      <div className="site-header-top">
        <a
          className="brand"
          aria-label="Mundo 3D, inicio"
          href="/"
          onClick={(event) => internalLink(event, () => choose(onCatalog))}
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
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="10.8" cy="10.8" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            id="header-product-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar productos o categorías"
            autoComplete="off"
          />
          <button className="sr-only" type="submit">Buscar en catálogo</button>
        </form>
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
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3h2l2.4 12h11.2L21 7H6" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            {cartCount > 0 && <span className="cart-badge" aria-hidden="true">{cartCount}</span>}
          </button>
        </div>
      </div>
      <div className="site-nav-row">
        <nav
          id="site-navigation"
          className="site-nav"
          aria-label="Principal"
          onScroll={() => setCategoriesOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && categoriesOpen) {
              setCategoriesOpen(false);
              categoryButtonRef.current?.focus();
            }
          }}
        >
          <button
            type="button"
            aria-current={(view === 'catalog' && !showingProcess) || view === 'product' ? 'page' : undefined}
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
              data-selected-category={category}
              aria-controls={categoriesOpen ? 'nav-category-desktop' : undefined}
              onClick={toggleCategories}
            >
              Categorías <span className="nav-category-chevron" aria-hidden="true">⌄</span>
            </button>
          </div>
          <a
            href="/disenar"
            aria-current={view === 'design' ? 'page' : undefined}
            onClick={(event) => internalLink(event, () => choose(onDesign))}
          >
            Diseño personalizado
          </a>
          <a
            href="/#proceso"
            aria-current={showingProcess ? 'location' : undefined}
            onClick={(event) => internalLink(event, () => choose(onHowItWorks))}
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
            onClick={(event) => internalLink(event, () => choose(onAbout))}
          >
            Sobre nosotros
          </a>
          {user ? (
            <>
              <button
                type="button"
                aria-current={view === 'orders' ? 'page' : undefined}
                onClick={() => choose(onOrders)}
              >
                Mis pedidos
              </button>
              {user.role === 'admin' && (
                <button
                  type="button"
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
                onClick={(event) => internalLink(event, () => choose(onProfile))}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.6" />
                  <path d="M4.5 20.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" />
                </svg>
              </a>
            </>
          ) : (
            <button type="button" className="outline" onClick={() => choose(onLogin)}>Ingresar</button>
          )}
        </nav>
      </div>
      {categoriesOpen && (
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
    </header>
  );
}
