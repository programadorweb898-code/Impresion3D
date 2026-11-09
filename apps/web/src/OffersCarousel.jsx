import { useEffect, useRef, useState } from 'react';
import { offerPath } from '@impresion3d/shared';
import { internalLink } from './site-content.js';
import './OffersCarousel.css';

const offers = [
  {
    id: 'navidad-combo',
    title: 'Tu Navidad, a tu manera.',
    product: 'Bandeja navideña + 4 adornos',
    description:
      'Elegí los 4 muñequitos o adornos que más te gusten y armá tu combinación.',
    detail:
      'Papá Noel, reno, árbol y jengibre: una combinación para inspirarte.',
    price: '$35.000',
    priceLabel: 'El combo completo',
    secondary: '',
    note: 'Adornos impresos en 3D con efecto tejido.',
    alt: 'Bandeja dorada con cuatro adornos de efecto tejido: Papá Noel, reno, árbol y jengibre',
  },
  {
    id: 'navidad-bolas',
    title: 'Un árbol lleno de detalles.',
    product: 'Bolas navideñas con efecto tejido',
    description: 'Sumá una o armá tu conjunto para decorar el árbol.',
    detail: 'Textura tejida, espíritu navideño.',
    price: '$2.500 c/u',
    priceLabel: 'Llevando 6 o más',
    secondary: 'De 1 a 5: $3.000 c/u',
    note: 'Adornos impresos en 3D con efecto tejido.',
    alt: 'Seis bolas tejidas en blanco, rojo, verde, marrón, dorado y plateado',
  },
  {
    id: 'llaveros',
    title: 'Un detalle para llevar.',
    product: 'Llaveros para vos o para regalar',
    description: 'Elegí tu diseño y aprovechá el precio por cantidad.',
    detail: 'Para tus llaves, tu mochila o un regalo.',
    price: '$2.000 c/u',
    priceLabel: 'Llevando 5 o más',
    secondary: 'También: 1 por $3.000',
    note: 'El precio de $2.000 por unidad se aplica desde 5 llaveros.',
    alt: 'Cinco llaveros impresos en 3D con los diseños de Malvinas y River',
  },
];

export function OffersCarousel({ onOffer }) {
  const region = useRef(null);
  const touch = useRef(null);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [enabled, setEnabled] = useState(true);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const playing = enabled && visible && pageVisible && !focused;
  const move = (delta) =>
    setIndex((current) => (current + delta + offers.length) % offers.length);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(region.current);
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      setReduced(media.matches);
    };
    media.addEventListener('change', onMotion);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', onMotion);
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % offers.length),
      6000,
    );
    return () => clearInterval(timer);
  }, [playing, index]);

  return (
    <section
      ref={region}
      className="home-offers"
      aria-labelledby="offers-title"
      aria-roledescription="carrusel"
      onFocusCapture={(event) =>
        setFocused(event.target.matches(':focus-visible'))
      }
      onBlurCapture={(event) => {
        setFocused(false);
      }}
    >
      <div className="offers-heading">
        <div>
          <p className="eyebrow">COMBINÁ. REGALÁ. APROVECHÁ.</p>
          <h2 id="offers-title">
            Ofertas para darle forma a tus ideas
            <span className="accent-dot">.</span>
          </h2>
        </div>
        <span className="offers-currency">Precios en pesos argentinos</span>
      </div>
      <div
        className={'offers-stage' + (reduced ? ' reduced-motion' : '')}
        aria-live={playing ? 'off' : 'polite'}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
          }
        }}
        onTouchStart={(event) => {
          const { clientX: x, clientY: y } = event.touches[0];
          touch.current = { x, y };
        }}
        onTouchCancel={() => {
          touch.current = null;
        }}
        onTouchEnd={(event) => {
          if (touch.current) {
            const dx = event.changedTouches[0].clientX - touch.current.x;
            const dy = event.changedTouches[0].clientY - touch.current.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy))
              move(dx < 0 ? 1 : -1);
          }
          touch.current = null;
        }}
      >
        {offers.map((offer, i) => (
          <article
            key={offer.id}
            className={'offer-slide' + (index === i ? ' is-active' : '')}
            inert={index !== i}
            aria-hidden={index !== i}
            role="group"
            aria-roledescription="oferta"
            aria-label={`${i + 1} de ${offers.length}: ${offer.product}`}
          >
            <div className="offer-copy">
              <span className="offer-badge">OFERTA</span>
              <p className="offer-product">{offer.product}</p>
              <h3>{offer.title}</h3>
              <p className="offer-description">{offer.description}</p>
              <div className="offer-price-block">
                <span className="offer-price-label">{offer.priceLabel}</span>
                <strong className="offer-price">{offer.price}</strong>
                {offer.secondary && (
                  <span className="offer-secondary-price">
                    {offer.secondary}
                  </span>
                )}
              </div>
              <a
                className="offer-cta"
                href={offerPath(offer.id)}
                onClick={(event) =>
                  internalLink(event, () => onOffer(offer.id))
                }
              >
                Agregar esta oferta <span aria-hidden="true">↗</span>
                <span className="sr-only">
                  : {offer.product} (ver opciones)
                </span>
              </a>
              <p className="offer-note">{offer.note}</p>
            </div>
            <figure className="offer-art">
              <img
                src={`/images/offers/${offer.id === 'navidad-bolas' ? 'navidad-bolas-colores' : offer.id}-1200.webp`}
                srcSet={`/images/offers/${offer.id === 'navidad-bolas' ? 'navidad-bolas-colores' : offer.id}-640.webp 640w, /images/offers/${offer.id === 'navidad-bolas' ? 'navidad-bolas-colores' : offer.id}-1200.webp 1200w`}
                sizes="(max-width: 700px) 90vw, 50vw"
                width="1200"
                height="800"
                loading="lazy"
                decoding="async"
                alt={offer.alt}
              />
              <figcaption>{offer.detail}</figcaption>
            </figure>
          </article>
        ))}
      </div>
      <div className="offers-controls">
        <div className="offers-manual">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Oferta anterior"
          >
            ←
          </button>
          <span className="offers-count" aria-hidden="true">
            0{index + 1} / 0{offers.length}
          </span>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Oferta siguiente"
          >
            →
          </button>
        </div>
        <div className="offers-dots" aria-label="Elegir oferta">
          {offers.map((offer, i) => (
            <button
              key={offer.id}
              type="button"
              aria-label={`Ver oferta ${i + 1}: ${offer.product}`}
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
            >
              <span />
            </button>
          ))}
        </div>
        <button
          className="offers-pause"
          type="button"
          onClick={() => setEnabled((current) => !current)}
          aria-label={
            enabled
              ? 'Pausar ofertas automáticas'
              : 'Activar ofertas automáticas'
          }
        >
          <span aria-hidden="true">{enabled ? 'Ⅱ' : '▷'}</span>{' '}
          {enabled ? 'Pausar' : 'Reproducir'}
        </button>
      </div>
    </section>
  );
}
