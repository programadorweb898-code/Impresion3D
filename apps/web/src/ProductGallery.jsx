import { useRef, useState } from 'react';
import { productGalleryImages } from './product-gallery-images.js';
import './ProductGallery.css';
export function ProductGallery({ product }) {
  const [index, setIndex] = useState(0);
  const touch = useRef(null);
  const images = productGalleryImages(product);
  const activeIndex = index < images.length ? index : 0;
  const current = images[activeIndex];
  const move = (delta) => setIndex((i) => (i + delta + images.length) % images.length);
  if (!current) return <figure className="product-detail-media"><p>Imagen todavía no disponible.</p></figure>;
  return <figure className="product-detail-media product-gallery" aria-label={'Fotos de ' + product.name}
    tabIndex={0}
    onKeyDown={(e) => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }}
    onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
    onTouchCancel={() => { touch.current = null; }}
    onTouchEnd={(e) => { if (touch.current !== null && Math.abs(e.changedTouches[0].clientX - touch.current) > 50) move(e.changedTouches[0].clientX < touch.current ? 1 : -1); touch.current = null; }}>
    <div className="product-gallery-stage">
      <img key={current.id} className={current.rotated ? 'gallery-image-rotated' : undefined} src={current.url} alt={product.name + ' — ' + current.label} width="1000" height="1000" fetchPriority={activeIndex === 0 ? 'high' : 'auto'} />
      {images.length > 1 && <>
        <button className="gallery-prev" type="button" aria-label="Foto anterior" onClick={() => move(-1)}>‹</button>
        <button className="gallery-next" type="button" aria-label="Foto siguiente" onClick={() => move(1)}>›</button>
      </>}
    </div>
    {images.length > 1 && <figcaption>
      <p className="small" aria-live="polite">{activeIndex + 1} / {images.length} · {current.label}</p>
      <div className="gallery-thumbnails">
        {images.map((image, i) => <button type="button" key={image.id} aria-label={'Ver foto: ' + image.label} aria-pressed={activeIndex === i} onClick={() => setIndex(i)}>
          <span className="gallery-thumbnail-image"><img className={image.rotated ? 'gallery-image-rotated' : undefined} src={image.url} alt="" loading="lazy" /></span><span>{image.label}</span>
        </button>)}
      </div>
    </figcaption>}
  </figure>;
}
