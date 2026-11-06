import { useState } from 'react';
import { api } from './api.js';
export function ProductGalleryEditor({ product, onUpdated }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function upload(event, slot) {
    const input = event.currentTarget, file = input.files?.[0];
    if (!file || busy) return;
    if (file.size > 5 * 1024 * 1024) { setError('La foto debe pesar como máximo 5 MB.'); input.value = ''; return; }
    setBusy(true); setError('');
    try {
      const data = new FormData(); data.append('image', file);
      await api('/admin/products/' + product._id + '/gallery/' + slot, { method:'POST', body:data });
      await onUpdated();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); input.value = ''; }
  }
  return <section aria-label={'Fotos adicionales de ' + product.name}>
    <h4>Fotos de la ficha</h4>
    <p className="small">El carrusel muestra la foto principal del catálogo y una foto en uso. Usá un encuadre abierto, con el producto entero y espacio para ver su entorno.</p>
    {[['context', 'En uso']].map(([slot, label]) => <label key={slot}>
      {label}
      {product.gallery?.[slot]?.url && <img src={product.gallery[slot].url} alt={label} width="80" height="80" style={{objectFit:'contain',background:'white'}} />}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => upload(e, slot)} />
    </label>)}
    {busy && <p role="status">Guardando foto…</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
