import { commonQuestions, internalLink } from './site-content.js';

export function InformationPage({ pageKey, onDesign, onCatalog }) {
  if (pageKey === 'faq')
    return (
      <article className="information-page" aria-labelledby="information-title">
        <p className="eyebrow">TE ACOMPAÑAMOS EN CADA PASO</p>
        <h1 id="information-title">Preguntas frecuentes</h1>
        <p className="information-lead">
          Lo que necesitás saber antes de darle forma a tu próxima idea.
        </p>
        <div className="faq-list">
          {commonQuestions.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
        <p>
          ¿Te quedó alguna duda? Encontrá nuestros medios de contacto al pie de
          esta página.
        </p>
      </article>
    );
  return (
    <article className="information-page" aria-labelledby="information-title">
      <p className="eyebrow">MUNDO 3D · IDEAS QUE TOMAN FORMA</p>
      <h1 id="information-title">Sobre nosotros</h1>
      <p className="information-lead">
        De una idea en pantalla a una pieza que podés tener en tus manos.
      </p>
      <section>
        <h2>Un mundo de posibilidades, pieza por pieza.</h2>
        <p>
          En Mundo 3D creamos productos mediante impresión 3D: objetos para el
          hogar, piezas decorativas y regalos. También recibimos tus propios
          modelos para revisar cómo llevarlos a la realidad.
        </p>
      </section>
      <section>
        <h2>Tu proyecto empieza con una conversación.</h2>
        <p>
          Podés elegir una pieza del catálogo o enviar tu archivo con las
          medidas y la cantidad que necesitás. Revisamos la viabilidad y
          coordinamos el presupuesto, las características y la entrega antes de
          confirmar el trabajo.
        </p>
      </section>
      <div className="information-actions">
        <a
          className="primary"
          href="/disenar"
          onClick={(e) => internalLink(e, onDesign)}
        >
          Consultá por tu diseño
        </a>
        <a href="/#catalogo" onClick={(e) => internalLink(e, onCatalog)}>
          Explorá el catálogo →
        </a>
      </div>
    </article>
  );
}
