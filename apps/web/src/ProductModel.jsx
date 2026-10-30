import { useState, useRef } from 'react';
import { api } from './api.js';
export function ProductModel({ product, onSaved, onPreview }) {
  const [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false),
    [error, setError] = useState('');
  const selection = useRef(0);
  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    let saved = false;
    try {
      const body = new FormData();
      body.append('model', file);
      await api('/admin/products/' + product._id + '/model', {
        method: 'POST',
        body,
      });
      saved = true;
      setFile(null);
      await onSaved();
    } catch (e) {
      setError(
        saved
          ? 'El modelo se guardó, pero no pudimos actualizar la lista. Recargá la página.'
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="model-editor">
      <h4>Modelo 3D del producto</h4>
      {product.model?.url ? (
        <>
          <p className="small">
            Modelo {product.model.format.toUpperCase()} disponible.
          </p>
          <button
            className="outline"
            type="button"
            onClick={() => onPreview(product)}
          >
            Revisar modelo 3D
          </button>
        </>
      ) : (
        <p className="small">
          Todavía no tiene modelo 3D. La foto sigue visible en el catálogo.
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          Archivo 3D de {product.name}
          <input
            type="file"
            accept=".glb,.stl"
            disabled={busy || reading}
            onChange={async (e) => {
              const input = e.currentTarget,
                selected = input.files?.[0],
                id = ++selection.current;
              setFile(null);
              setError('');
              if (!selected) return;
              if (
                !/\.(glb|stl)$/i.test(selected.name) ||
                selected.size > 10 * 1024 * 1024
              ) {
                input.value = '';
                setError('Usá un archivo GLB o STL de hasta 10 MiB.');
                return;
              }
              setReading(true);
              try {
                const bytes = await selected.arrayBuffer();
                if (id === selection.current)
                  setFile(
                    new File([bytes], selected.name, {
                      type: 'application/octet-stream',
                    }),
                  );
              } catch {
                setError(
                  'No se pudo leer el archivo. Descargalo en tu dispositivo y volvé a seleccionarlo.',
                );
                input.value = '';
              } finally {
                setReading(false);
              }
            }}
          />
        </label>
        <p className="small">
          GLB con recursos incluidos o STL. Hasta 10 MiB. No se genera un modelo
          a partir de la foto.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="outline" disabled={busy || reading || !file}>
          {reading
            ? 'Preparando archivo…'
            : busy
              ? 'Guardando modelo…'
              : product.model?.url
                ? 'Reemplazar modelo 3D'
                : 'Subir modelo 3D'}
        </button>
      </form>
    </section>
  );
}
