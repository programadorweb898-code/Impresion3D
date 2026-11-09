import { Brand } from './Brand.jsx';
import { legalPages, legalSite } from '@impresion3d/shared';
import {
  commonQuestions,
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
            <a href={'mailto:' + siteContact.email}>{siteContact.email}</a>
            <a href={siteContact.phoneHref}>Teléfono: {siteContact.phone}</a>
            <a
              href={'https://wa.me/' + siteContact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escribinos por WhatsApp <span aria-hidden="true">↗</span>
              <span className="sr-only"> (se abre en otra pestaña)</span>
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
        <section
          className="footer-column footer-faq"
          aria-labelledby="footer-faq-title"
        >
          <h2 id="footer-faq-title">Preguntas frecuentes</h2>
          {commonQuestions.slice(0, 3).map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
          <a
            href={informationPages.faq.path}
            onClick={(e) => internalLink(e, () => onInformation('faq'))}
          >
            Ver todas las preguntas <span aria-hidden="true">→</span>
          </a>
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
