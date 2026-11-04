import { useState } from 'react';
import './ProductGallery.css';
export function ProductGallery({ product }) {
  const [index, setIndex] = useState(0);
  const [touch, setTouch] = useState(null);
  const images = [
    { ...product.image, label: 'Principal' },
    { ...product.gallery?.angle, label: 'Otro ángulo' },
    { ...product.gallery?.context, label: 'En uso' },
  ].filter((image) => image.url);
  const current = images[index] || images[0];
  const move = (delta) => setIndex((i) => (i + delta + images.length) % images.length);
  if (!current) return <figure className="product-detail-media"><p>Imagen todavía no disponible.</p></figure>;
  return <figure className="product-detail-media product-gallery" aria-label={'Fotos de ' + product.name}
    tabIndex={0}
    onKeyDown={(e) => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }}
    onTouchStart={(e) => setTouch(e.touches[0].clientX)}
    onTouchEnd={(e) => { if (touch !== null && Math.abs(e.changedTouches[0].clientX - touch) > 50) move(e.changedTouches[0].clientX < touch ? 1 : -1); setTouch(null); }}>
    <div className="product-gallery-stage">
      <img key={current.url} src={current.url} alt={product.name + ' — ' + current.label} width="1000" height="1000" fetchPriority={index === 0 ? 'high' : 'auto'} />
      {images.length > 1 && <>
        <button className="gallery-prev" type="button" aria-label="Foto anterior" onClick={() => move(-1)}>‹</button>
        <button className="gallery-next" type="button" aria-label="Foto siguiente" onClick={() => move(1)}>›</button>
      </>}
    </div>
    {images.length > 1 && <figcaption>
      <p className="small" aria-live="polite">{index + 1} / {images.length} · {current.label}</p>
      <div className="gallery-thumbnails">
        {images.map((image, i) => <button type="button" key={image.url} aria-label={'Ver foto: ' + image.label} aria-pressed={index === i} onClick={() => setIndex(i)}>
          <img src={image.url} alt="" loading="lazy" /><span>{image.label}</span>
        </button>)}
      </div>
    </figcaption>}
  </figure>;
}
