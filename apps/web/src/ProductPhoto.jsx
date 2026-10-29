import { useState, useEffect } from 'react';
import { api } from './api.js';
export function ProductPhoto({ product, onSaved }) {
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    const form = new FormData();
    form.append('image', file);
    try {
      await api('/admin/products/' + product._id + '/image', {
        method: 'POST',
        body: form,
      });
      setFile(null);
      await onSaved();
      setNotice('Foto guardada.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="photo-editor" onSubmit={upload}>
      {(preview || product.image?.url) && (
        <img
          className="admin-photo"
          src={preview || product.image.url}
          alt={'Foto de ' + product.name}
          loading="lazy"
        />
      )}
      <label>
        Foto de {product.name}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            setError('');
            setNotice('');
            if (
              selected &&
              (!['image/jpeg', 'image/png', 'image/webp'].includes(
                selected.type,
              ) ||
                selected.size > 5 * 1024 * 1024)
            ) {
              setFile(null);
              setError('Elegí JPG, PNG o WebP de hasta 5 MiB.');
              e.target.value = '';
              return;
            }
            setFile(selected || null);
          }}
        />
      </label>
      <p className="small">
        Una foto JPG, PNG o WebP. Hasta 5 MiB y 20 megapíxeles.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button type="submit" className="outline" disabled={busy || !file}>
        {busy
          ? 'Subiendo foto…'
          : product.image?.url
            ? 'Reemplazar foto'
            : 'Subir foto'}
      </button>
    </form>
  );
}
