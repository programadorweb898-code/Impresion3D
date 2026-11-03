import { legalPages, legalSite } from '@impresion3d/shared';
export function LegalPage({ pageKey }) {
  const page = legalPages[pageKey];
  return (
    <article className="legal-page" aria-labelledby="legal-title">
      <p className="eyebrow">{legalSite.name} · INFORMACIÓN DEL SITIO</p>
      <h1 id="legal-title">{page.title}</h1>
      <p className="legal-updated">Última actualización: {legalSite.updated}</p>
      <p className="legal-introduction">{page.introduction}</p>
      <div className="legal-contact">
        <strong>Responsable: {legalSite.responsible}</strong>
        <span>{legalSite.country}</span>
        <a href={'mailto:' + legalSite.email}>{legalSite.email}</a>
      </div>
      {page.sections.map((section) => (
        <section
          className="legal-section"
          key={section.id}
          id={section.id}
          aria-labelledby={'legal-' + section.id}
        >
          <h2 id={'legal-' + section.id}>{section.title}</h2>
          {section.paragraphs?.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
          {section.items && (
            <ul>
              {section.items.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          )}
          {section.after?.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
          {section.link && (
            <p>
              <a href={section.link.href}>{section.link.label}</a>
            </p>
          )}
          {section.emailSubject && (
            <p>
              <a
                className="legal-action"
                href={
                  'mailto:' +
                  legalSite.email +
                  '?subject=' +
                  encodeURIComponent(section.emailSubject)
                }
              >
                {section.emailLabel}
              </a>
            </p>
          )}
        </section>
      ))}
    </article>
  );
}
