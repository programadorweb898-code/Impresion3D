import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import PhotoQuotes from './PhotoQuotes.jsx';

const maxBytes = 5 * 1024 * 1024;
const accepted = ['image/jpeg', 'image/png', 'image/webp'];

export default function PhotoQuoteForm() {
  const [user, setUser] = useState(undefined);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [approximateSize, setApproximateSize] = useState('');
  const [details, setDetails] = useState('');
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const check = () =>
      api('/auth/me')
        .then((account) => {
          if (!active) return;
          setUser(account);
          setEmail((current) => current || account.email || '');
        })
        .catch(() => {
          if (active) setUser(null);
        });
    check();
    window.addEventListener('focus', check);
    return () => {
      active = false;
      window.removeEventListener('focus', check);
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!sent) return;
    const timeout = window.setTimeout(() => setSent(null), 1500);
    return () => window.clearTimeout(timeout);
  }, [sent]);

  function changed() {
    setError('');
    setRequestId(crypto.randomUUID());
  }

  function selectPhoto(candidate) {
    changed();
    if (!candidate) {
      setFile(null);
      return;
    }
    if (!accepted.includes(candidate.type) || !candidate.size || candidate.size > maxBytes) {
      setFile(null);
      setError('Elegí una imagen JPG, PNG o WebP de hasta 5 MB.');
      return;
    }
    setFile(candidate);
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || !user || !consent || busy) return;
    setBusy(true);
    setError('');
    const metadata = {
      requestId,
      quantity: Number(quantity),
      approximateSize: approximateSize.trim(),
      details: details.trim(),
      contact: {
        method,
        value: method === 'email' ? email.trim().toLowerCase() : phone.trim(),
      },
      contactConsent: consent,
    };
    const body = new FormData();
    body.set('image', file);
    body.set('metadata', JSON.stringify(metadata));
    try {
      const response = await api('/photo-quotes', { method: 'POST', body });
      setSent(response);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setQuantity(1);
      setApproximateSize('');
      setDetails('');
      setMethod('email');
      setEmail('');
      setPhone('');
      setConsent(false);
      setRequestId(crypto.randomUUID());
      setRefresh((value) => value + 1);
    } catch (cause) {
      if (cause.status === 401) setUser(null);
      setError(cause.message || 'No pudimos enviar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="design-page photo-quote-page" aria-labelledby="photo-quote-title">
      <header className="photo-quote-hero">
        <div className="photo-quote-hero-copy">
          <p className="photo-quote-eyebrow">
            <span aria-hidden="true" className="photo-quote-eyebrow-dot" />
            SOMOS MUNDO 3D · SERVICIO PERSONALIZADO
          </p>
          <h1 id="photo-quote-title">
            Tu idea, hecha <span>a medida.</span>
          </h1>
          <p className="photo-quote-lead">
            ¿Viste algo que te gustaría tener en 3D? Enviá una imagen de referencia,
            contanos los detalles y te preparamos un presupuesto personalizado.
            No necesitás saber diseñar ni tener un archivo 3D.
          </p>
          <div className="photo-quote-hero-tags" aria-label="Características del servicio">
            <span>Solo una imagen</span>
            <span>Presupuesto a medida</span>
            <span>Respuesta por email o WhatsApp</span>
          </div>
        </div>
        <div className="photo-quote-steps" aria-label="Cómo funciona el proceso">
          <p className="photo-quote-steps-title">Así de simple</p>
          <ol>
            <li><span aria-hidden="true">01</span><div><strong>Compartí tu referencia</strong><small>Una foto o imagen de lo que imaginás.</small></div></li>
            <li><span aria-hidden="true">02</span><div><strong>Contanos cómo lo querés</strong><small>Medida, cantidad y detalles.</small></div></li>
            <li><span aria-hidden="true">03</span><div><strong>Recibí tu presupuesto</strong><small>Elegí WhatsApp o correo electrónico.</small></div></li>
          </ol>
        </div>
      </header>

      {user === undefined ? (
        <div className="photo-quote-session-card" role="status">Comprobando tu sesión…</div>
      ) : !user ? (
        <section className="photo-quote-session-card" aria-labelledby="photo-login-title">
          <div className="photo-quote-session-icon" aria-hidden="true">
            <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <div>
            <h2 id="photo-login-title">Iniciá sesión para pedir tu presupuesto</h2>
            <p>Tu solicitud y la respuesta quedarán guardadas en tu cuenta. Es rápido y te permite hacer seguimiento.</p>
          </div>
          <a className="photo-quote-login-link" href="/login" target="_blank" rel="noopener noreferrer">
            Iniciar sesión o registrarme <span aria-hidden="true">↗</span>
          </a>
        </section>
      ) : (
        <>
          <div className="photo-quote-workspace">
            <form className="photo-quote-form" onSubmit={submit}>
              <div className="photo-quote-form-heading">
                <p>CREÁ TU SOLICITUD</p>
                <h2>Contanos tu idea</h2>
                <span>Completá los datos para que podamos evaluar la impresión.</span>
              </div>
              <div className="photo-quote-form-section">
                <div className="photo-quote-section-heading">
                  <span className="photo-quote-step-number">01</span>
                  <h3>Imagen de referencia</h3>
                </div>
                <label className="photo-quote-image-field">
                  <span className="photo-quote-upload-icon" aria-hidden="true">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="2" />
                      <path d="m3 17 5-5 4 4 4-5 5 6" />
                    </svg>
                  </span>
                  <strong>1. Foto del producto que querés imprimir</strong>
                  <span>Elegí una foto, captura o ilustración de lo que tenés en mente.</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    required={!file}
                    disabled={busy}
                    onChange={(event) => selectPhoto(event.target.files?.[0])}
                  />
                  <span className="photo-quote-file-help">JPG, PNG o WebP · Hasta 5 MB</span>
                </label>
                {preview && (
                  <div className="photo-quote-image-preview">
                    <img className="photo-quote-preview" src={preview} alt="Vista previa de la imagen seleccionada" />
                    <p>{file?.name}</p>
                  </div>
                )}
              </div>

              <div className="photo-quote-form-section">
                <div className="photo-quote-section-heading">
                  <span className="photo-quote-step-number">02</span>
                  <h3>Detalles del diseño</h3>
                </div>
                <div className="photo-quote-grid">
                  <label>
                    <strong>2. Cantidad</strong>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      required
                      value={quantity}
                      disabled={busy}
                      onChange={(event) => { setQuantity(event.target.value); changed(); }}
                    />
                  </label>
                  <label>
                    <strong>Tamaño aproximado (opcional)</strong>
                    <input
                      type="text"
                      maxLength="120"
                      placeholder="Ej.: 15 cm de alto"
                      value={approximateSize}
                      disabled={busy}
                      onChange={(event) => { setApproximateSize(event.target.value); changed(); }}
                    />
                  </label>
                </div>
                <label>
                  <strong>Detalles del pedido (opcional)</strong>
                  <textarea
                    rows={4}
                    maxLength={1500}
                    placeholder="Colores, materiales, para qué lo querés, detalles importantes..."
                    value={details}
                    disabled={busy}
                    onChange={(event) => { setDetails(event.target.value); changed(); }}
                  />
                </label>
              </div>

              <fieldset className="photo-quote-contact photo-quote-form-section">
                <legend className="photo-quote-contact-legend">
                  <span className="photo-quote-step-number">03</span>
                  <strong>¿Cómo querés recibir tu presupuesto?</strong>
                </legend>
                <div className="photo-quote-radio">
                  <label className={method === 'email' ? 'is-selected' : ''}>
                    <input type="radio" name="quote-contact" checked={method === 'email'} disabled={busy} onChange={() => { setMethod('email'); changed(); }} />
                    Correo electrónico
                  </label>
                  <label className={method === 'whatsapp' ? 'is-selected' : ''}>
                    <input type="radio" name="quote-contact" checked={method === 'whatsapp'} disabled={busy} onChange={() => { setMethod('whatsapp'); changed(); }} />
                    WhatsApp
                  </label>
                </div>
                {method === 'email' ? (
                  <label>
                    <strong>Tu correo electrónico</strong>
                    <input
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      required
                      value={email}
                      disabled={busy}
                      onChange={(event) => { setEmail(event.target.value); changed(); }}
                    />
                    <span className="photo-quote-field-help">Usamos este email únicamente para responder la consulta.</span>
                  </label>
                ) : (
                  <label>
                    <strong>Tu número de WhatsApp</strong>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="11 5555-5555"
                      maxLength={32}
                      required
                      value={phone}
                      disabled={busy}
                      onChange={(event) => { setPhone(event.target.value); changed(); }}
                    />
                    <span className="photo-quote-field-help">Código de área y número, sin 0 ni 15. Ejemplo: 11 5555-5555.</span>
                  </label>
                )}
              </fieldset>

              <div className="photo-quote-form-footer">
                <label className="photo-quote-consent">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    disabled={busy}
                    onChange={(event) => { setConsent(event.target.checked); changed(); }}
                  />
                  <span>Acepto que Somos Mundo 3D use este contacto únicamente para responder mi solicitud de presupuesto.</span>
                </label>
                <p className="photo-quote-field-help">
                  La imagen es una referencia. Confirmaremos si es posible imprimir el diseño antes de acordar el precio. Enviar la solicitud no confirma una compra.
                </p>
                <button className="photo-quote-submit" type="submit" disabled={busy || !file}>
                  {busy ? 'Enviando solicitud…' : 'Solicitar presupuesto'}
                  <span aria-hidden="true">↗</span>
                </button>
                {error && <p className="error" role="alert">{error}</p>}
                {sent && (
                  <div className="photo-quote-success-toast" role="status" aria-live="polite">
                    <span>Solicitud #{String(sent._id).slice(-6).toUpperCase()} recibida. Podés consultar el estado y la respuesta más abajo.</span>
                    <button type="button" className="photo-quote-toast-close" aria-label="Cerrar notificación" onClick={() => setSent(null)}>×</button>
                  </div>
                )}
              </div>
            </form>

            <aside className="photo-quote-aside" aria-label="Información importante">
              <div className="photo-quote-aside-highlight">
                <span className="photo-quote-aside-sparkle" aria-hidden="true">✧</span>
                <h2>De una imagen a algo real.</h2>
                <p>Cada proyecto es distinto. Revisamos el diseño, sus dimensiones y la cantidad para brindarte un presupuesto acorde.</p>
              </div>
              <div className="photo-quote-aside-details">
                <h3>Lo que necesitás saber</h3>
                <p><strong>No hace falta un modelo 3D.</strong> Con una foto podemos evaluar tu idea.</p>
                <p><strong>El presupuesto es personalizado.</strong> Depende de la complejidad, el tamaño y los materiales.</p>
                <p><strong>Podés hacer seguimiento.</strong> Tu consulta quedará disponible en tu cuenta.</p>
              </div>
            </aside>
          </div>
          <PhotoQuotes refresh={refresh} />
        </>
      )}
    </section>
  );
}
