import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import DesignRequests from './DesignRequests.jsx';
export default function DesignRequestForm({ file, dimensions }) {
  const [scale, setScale] = useState(1),
    [quantity, setQuantity] = useState(1),
    [usage, setUsage] = useState(''),
    [account, setAccount] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [sent, setSent] = useState(null),
    [refresh, setRefresh] = useState(0),
    [editing, setEditing] = useState(null),
    [draft, setDraft] = useState('');
  const dialog = useRef(null),
    submit = useRef(null),
    requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    const check = () =>
      api('/auth/me')
        .then((u) => {
          if (active) setAccount(u);
        })
        .catch(() => {
          if (active) setAccount(null);
        });
    check();
    window.addEventListener('focus', check);
    return () => {
      active = false;
      window.removeEventListener('focus', check);
    };
  }, []);
  useEffect(() => {
    setScale(1);
    setSent(null);
    setError('');
    setEditing(null);
    requestId.current = crypto.randomUUID();
    dialog.current?.close();
  }, [file]);
  const ready =
    file && dimensions && !editing && Number.isFinite(scale) && scale > 0;
  const colorStatus = dimensions?.colorStatus || 'unknown';
  const changed = () => {
    setSent(null);
    requestId.current = crypto.randomUUID();
  };
  async function send(acceptedMissingColor = false) {
    dialog.current?.close();
    if (!ready || busy || sent) return;
    setBusy(true);
    setError('');
    const body = new FormData();
    body.set('model', file);
    body.set(
      'metadata',
      JSON.stringify({
        requestId: requestId.current,
        quantity: Number(quantity),
        scale,
        dimensions: Object.fromEntries(
          ['width', 'height', 'depth'].map((k) => [k, dimensions[k] * scale]),
        ),
        usage,
        colorStatus,
        acceptedMissingColor,
      }),
    );
    try {
      const result = await api('/design-requests', { method: 'POST', body });
      setSent(result);
      setRefresh((v) => v + 1);
    } catch (e) {
      if (e.status === 401) setAccount(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="design-request-form">
      <h2>Solicitar presupuesto</h2>
      <p>
        Elegí la cantidad y el tamaño. Revisaremos tu archivo y te responderemos
        desde «Mis solicitudes de presupuesto».
      </p>
      {file && dimensions && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready || sent) return;
            if (colorStatus !== 'complete') {
              dialog.current.showModal();
            } else send();
          }}
        >
          <fieldset disabled={busy}>
            <div className="quote-inputs">
              {['width', 'height', 'depth'].map((key, index) => (
                <label key={key}>
                  {['Ancho', 'Alto', 'Profundidad'][index]} (cm)
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    max="100000"
                    required
                    value={
                      editing === key
                        ? draft
                        : Number(((dimensions[key] * scale) / 10).toFixed(4))
                    }
                    onFocus={(e) => {
                      setEditing(key);
                      setDraft(e.target.value);
                    }}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      const value = Number(e.target.value);
                      if (value > 0 && dimensions[key] > 0) {
                        setScale((value * 10) / dimensions[key]);
                        changed();
                      }
                    }}
                    onBlur={() => setEditing(null)}
                  />
                </label>
              ))}
            </div>
            <p className="small">
              Proporciones bloqueadas: al cambiar una medida, las otras dos se
              ajustan sin deformar el modelo. La vista 3D muestra la geometría
              original; estas son las medidas solicitadas. En archivos con
              varias piezas se escala todo el conjunto por igual, incluidos los
              espacios entre piezas.
            </p>
            <button
              type="button"
              className="outline"
              onClick={() => {
                setScale(1);
                changed();
              }}
            >
              Restablecer tamaño original
            </button>
            <label>
              Cantidad
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                required
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  changed();
                }}
              />
            </label>
            <label>
              ¿Para qué lo vas a usar? (opcional)
              <textarea
                maxLength="1000"
                value={usage}
                onChange={(e) => {
                  setUsage(e.target.value);
                  changed();
                }}
              />
            </label>
            <p className="small">
              Al enviar se guarda tu archivo original de forma privada, junto
              con la cantidad y el tamaño solicitado. El material y la
              viabilidad de impresión se definen durante la revisión.
            </p>
            {account ? (
              <button
                className="primary"
                ref={submit}
                disabled={!ready || busy || !!sent}
              >
                {busy
                  ? 'Enviando solicitud…'
                  : sent
                    ? 'Solicitud enviada'
                    : 'Solicitar presupuesto'}
              </button>
            ) : (
              <p>
                <a
                  className="outline"
                  href="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Iniciar sesión para enviar
                </a>
                <span className="small">
                  {' '}
                  Se abre en otra pestaña para conservar tu archivo. Después de
                  ingresar, volvé acá.
                </span>
              </p>
            )}
          </fieldset>
        </form>
      )}
      {!file && <p>Subí un modelo para solicitar su presupuesto.</p>}
      {error && (
        <p role="alert" className="error">
          {error} Revisá tus solicitudes antes de volver a enviar; el archivo
          sigue seleccionado.
        </p>
      )}
      {sent && (
        <p role="status" className="notice">
          Solicitud #{sent._id.slice(-6).toUpperCase()} recibida. Podés
          consultar su estado más abajo.
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="color-warning-title"
        aria-describedby="color-warning-copy"
        onClose={() => submit.current?.focus()}
      >
        <div className="color-warning">
          <h2 id="color-warning-title">
            {colorStatus === 'missing'
              ? 'Hay partes sin color asignado'
              : 'No pudimos verificar todos los colores'}
          </h2>
          <p id="color-warning-copy">
            {colorStatus === 'missing'
              ? 'Detectamos partes del modelo sin un color definido.'
              : 'El archivo puede usar información de color que este visor no reconoce. No significa que esas partes estén sin color.'}{' '}
            El blanco definido en el archivo cuenta como un color válido.
            ¿Deseás enviar el archivo igualmente para revisión?
          </p>
          <div className="quote-options">
            <button
              type="button"
              className="primary"
              onClick={() => send(true)}
            >
              Enviar
            </button>
            <button
              type="button"
              className="outline"
              autoFocus
              onClick={() => dialog.current.close()}
            >
              Cancelar
            </button>
          </div>
        </div>
      </dialog>
      {account && <DesignRequests refresh={refresh} />}
    </section>
  );
}
