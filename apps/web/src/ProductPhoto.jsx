import { useState, useEffect, useRef } from 'react';
import { api } from './api.js';
export function ProductPhoto({ product, onSaved }) {
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [reading, setReading] = useState(false);
  const selection = useRef(0);
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
    let saved = false;
    try {
      await api('/admin/products/' + product._id + '/image', {
        method: 'POST',
        body: form,
      });
      saved = true;
      setFile(null);
      await onSaved();
      setNotice('Foto guardada.');
    } catch (e) {
      setError(
        saved
          ? 'La foto se guardó, pero no pudimos actualizar la lista. Recargá la página para verla.'
          : e.message,
      );
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
          onChange={async (e) => {
            const input = e.currentTarget;
            const chosen = ++selection.current;
            const selected = input.files?.[0];
            setFile(null);
            setError('');
            setNotice('');
            setReading(false);
            if (!selected) return;
            if (
              !['image/jpeg', 'image/png', 'image/webp'].includes(
                selected.type,
              ) ||
              selected.size > 5 * 1024 * 1024
            ) {
              setError('Elegí JPG, PNG o WebP de hasta 5 MiB.');
              input.value = '';
              return;
            }
            setReading(true);
            try {
              // Copy bytes immediately so the upload doesn't depend on a mobile
              // file provider keeping a temporary file handle alive.
              const bytes = await selected.arrayBuffer();
              if (chosen !== selection.current) return;
              if (!bytes.byteLength) throw new Error('Archivo vacío');
              setFile(
                new File([bytes], selected.name, { type: selected.type }),
              );
            } catch {
              if (chosen === selection.current) {
                input.value = '';
                setError(
                  'No pudimos leer esa foto. Descargala en tu teléfono y volvé a seleccionarla.',
                );
              }
            } finally {
              if (chosen === selection.current) setReading(false);
            }
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
      <button
        type="submit"
        className="outline"
        disabled={busy || reading || !file}
      >
        {reading
          ? 'Preparando foto…'
          : busy
            ? 'Subiendo foto…'
            : product.image?.url
              ? 'Reemplazar foto'
              : 'Subir foto'}
      </button>
    </form>
  );
}
