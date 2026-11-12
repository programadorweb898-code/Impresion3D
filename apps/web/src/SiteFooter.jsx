import { Brand } from './Brand.jsx';
import { legalPages, legalSite } from '@impresion3d/shared';
import {
  informationPages,
  internalLink,
  siteContact,
  socialLinks,
} from './site-content.js';

export function SiteFooter({
  categories,
  view,
  onCatalog,
  onCategory,
  onInformation,
  onLegal,
}) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <section className="footer-intro" aria-label="Mundo 3D">
          <a
            className="brand"
            aria-label="Mundo 3D, inicio"
            href="/"
            onClick={(e) => internalLink(e, onCatalog)}
          >
            <Brand />
          </a>
          <p className="footer-tagline">Ideas que toman forma.</p>
          <p>
            Piezas para tu espacio, regalos y diseños propios hechos realidad
            con impresión 3D.
          </p>
          <a
            href="https://makerworld.com/es"
            target="_blank"
            rel="noopener noreferrer"
          >
            MakerWorld <span aria-hidden="true">↗</span>
          </a>
          <a
            href={informationPages.about.path}
            onClick={(e) => internalLink(e, () => onInformation('about'))}
          >
            Sobre nosotros
          </a>
        </section>
        <nav
          className="footer-column"
          aria-labelledby="footer-categories-title"
        >
          <h2 id="footer-categories-title">Explorá el catálogo</h2>
          <ul>
            <li>
              <a
                href="/#catalogo"
                onClick={(e) => internalLink(e, () => onCategory('Todos'))}
              >
                Todos los productos
              </a>
            </li>
            {categories.map((category) => (
              <li key={category}>
                <a
                  href={
                    '/?categoria=' + encodeURIComponent(category) + '#catalogo'
                  }
                  onClick={(e) => internalLink(e, () => onCategory(category))}
                >
                  {category}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <section
          className="footer-column"
          aria-labelledby="footer-contact-title"
        >
          <h2 id="footer-contact-title">Hablemos de tu idea</h2>
          <address>
            <a
              className="footer-contact-link"
              href={'mailto:' + siteContact.email}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span className="sr-only">Correo electrónico: </span>
              <span>{siteContact.email}</span>
            </a>
            <a className="footer-contact-link" href={siteContact.phoneHref}>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z" />
              </svg>
              <span className="sr-only">Teléfono: </span>
              <span>{siteContact.phone}</span>
            </a>
            {socialLinks().map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label} <span aria-hidden="true">↗</span>
                <span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            ))}
          </address>
        </section>
      </div>
      <div className="footer-bottom">
        <small>
          © {new Date().getFullYear()} {legalSite.name} · Ideas que toman forma.
        </small>
        <nav aria-label="Información legal" className="footer-legal">
          {Object.entries(legalPages).map(([key, page]) => (
            <a
              key={key}
              href={page.path}
              aria-current={view === key ? 'page' : undefined}
              onClick={(e) => internalLink(e, () => onLegal(key))}
            >
              {page.title}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
