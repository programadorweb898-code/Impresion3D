import { legalPages, legalSite } from '@impresion3d/shared';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );
const paragraph = (text) => '<p>' + escape(text) + '</p>';
export function renderLegalDocument(template, key) {
  const page = legalPages[key];
  const sections = page.sections
    .map(
      (section) =>
        '<section class="legal-section" id="' +
        escape(section.id) +
        '"><h2>' +
        escape(section.title) +
        '</h2>' +
        (section.paragraphs || []).map(paragraph).join('') +
        (section.items
          ? '<ul>' +
            section.items
              .map((text) => '<li>' + escape(text) + '</li>')
              .join('') +
            '</ul>'
          : '') +
        (section.after || []).map(paragraph).join('') +
        (section.link
          ? '<p><a href="' +
            escape(section.link.href) +
            '">' +
            escape(section.link.label) +
            '</a></p>'
          : '') +
        (section.emailSubject
          ? '<p><a class="legal-action" href="mailto:' +
            escape(legalSite.email) +
            '?subject=' +
            encodeURIComponent(section.emailSubject) +
            '">' +
            escape(section.emailLabel) +
            '</a></p>'
          : '') +
        '</section>',
    )
    .join('');
  const content =
    '<header class="legal-static-header"><a class="brand" href="/">' +
    escape(legalSite.name) +
    '</a><nav aria-label="Principal"><a href="/">Catálogo</a><a href="/login">Ingresar</a></nav></header><div class="page-back"><a href="/">← Volver al catálogo</a></div><main><article class="legal-page"><p class="eyebrow">' +
    escape(legalSite.name) +
    ' · INFORMACIÓN DEL SITIO</p><h1>' +
    escape(page.title) +
    '</h1><p class="legal-updated">Última actualización: ' +
    escape(legalSite.updated) +
    '</p><p class="legal-introduction">' +
    escape(page.introduction) +
    '</p><div class="legal-contact"><strong>Responsable: ' +
    escape(legalSite.responsible) +
    '</strong><span>' +
    escape(legalSite.country) +
    '</span><a href="mailto:' +
    escape(legalSite.email) +
    '">' +
    escape(legalSite.email) +
    '</a></div>' +
    sections +
    '</article></main><footer><a class="brand" href="/">' +
    escape(legalSite.name) +
    '</a><div class="footer-legal"><a href="' +
    legalPages.privacy.path +
    '">Política de privacidad</a><a href="' +
    legalPages.terms.path +
    '">Términos y condiciones</a><a href="mailto:' +
    escape(legalSite.email) +
    '">' +
    escape(legalSite.email) +
    '</a></div></footer>';
  const root = /<div\s+id=["']root["'][^>]*>[\s\S]*?<\/div>/;
  let html = root.test(template)
    ? template.replace(root, () => '<div id="root">' + content + '</div>')
    : template.replace(/<body[^>]*>/, (match) => match + content);
  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    '<title>' +
      escape(page.title) +
      ' | ' +
      escape(legalSite.name) +
      '</title>',
  );
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    (_, start, end) => start + escape(page.introduction) + end,
  );
  return html;
}
