import { useEffect, useState } from 'react';
import { api } from './api.js';
import PhotoQuotes from './PhotoQuotes.jsx';

const maxBytes = 5 * 1024 * 1024;
const accepted = ['image/jpeg', 'image/png', 'image/webp'];
const normalizePhone = (value) => value.replace(/[\s().-]/g, '');

export default function PhotoQuoteForm() {
  const [user, setUser] = useState(undefined);
  const [file, setFile] = useState(null);
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

  function changed() {
    setSent(null);
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
    if (!file || !user || !consent || busy || sent) return;
    setBusy(true);
    setError('');
    const metadata = {
      requestId,
      quantity: Number(quantity),
      approximateSize: approximateSize.trim(),
      details: details.trim(),
      contact: {
        method,
        value: method === 'email' ? email.trim().toLowerCase() : normalizePhone(phone),
      },
      contactConsent: consent,
    };
    const body = new FormData();
    body.set('image', file);
    body.set('metadata', JSON.stringify(metadata));
    try {
      const response = await api('/photo-quotes', { method: 'POST', body });
      setSent(response);
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
      <p className="eyebrow">IMPRESIONES PERSONALIZADAS</p>
      <h1 id="photo-quote-title">Convertí tu idea en impresión 3D</h1>
      <p>Subí una foto o imagen de referencia, contanos qué necesitás y te responderemos con un presupuesto. No necesitás un modelo 3D.</p>
      {user === undefined ? (
        <p role="status">Verificando tu sesión…</p>
      ) : !user ? (
        <div className="photo-quote-login">
          <h2>Iniciá sesión para pedir tu presupuesto</h2>
          <p>Necesitamos tu cuenta para guardar la solicitud y mostrarte nuestra respuesta.</p>
          <a className="primary" href="/login" target="_blank" rel="noopener noreferrer">
            Iniciar sesión o registrarme
          </a>
          <p className="small">Después de ingresar, volvé a esta pestaña.</p>
        </div>
      ) : (
        <>
          <form className="photo-quote-form" onSubmit={submit}>
            <label className="photo-quote-image-field">
              <strong>1. Foto del producto que querés imprimir</strong>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={!file}
                disabled={busy || !!sent}
                onChange={(event) => selectPhoto(event.target.files?.[0])}
              />
              <span className="small">JPG, PNG o WebP · Hasta 5 MB</span>
            </label>
            {preview && (
              <img className="photo-quote-preview" src={preview} alt="Vista previa de la imagen seleccionada" />
            )}
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
                  disabled={busy || !!sent}
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
                  disabled={busy || !!sent}
                  onChange={(event) => { setApproximateSize(event.target.value); changed(); }}
                />
              </label>
            </div>
            <label>
              <strong>Detalles del pedido (opcional)</strong>
              <textarea
                rows={3}
                maxLength={1500}
                placeholder="Colores, para qué lo querés, detalles a conservar..."
                value={details}
                disabled={busy || !!sent}
                onChange={(event) => { setDetails(event.target.value); changed(); }}
              />
            </label>
            <fieldset className="photo-quote-contact">
              <legend><strong>3. ¿Cómo querés recibir tu presupuesto?</strong></legend>
              <div className="photo-quote-radio">
                <label>
                  <input type="radio" name="quote-contact" checked={method === 'email'} disabled={busy || !!sent} onChange={() => { setMethod('email'); changed(); }} />
                  Correo electrónico
                </label>
                <label>
                  <input type="radio" name="quote-contact" checked={method === 'whatsapp'} disabled={busy || !!sent} onChange={() => { setMethod('whatsapp'); changed(); }} />
                  WhatsApp
                </label>
              </div>
              {method === 'email' ? (
                <label>
                  Tu correo electrónico
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={email}
                    disabled={busy || !!sent}
                    onChange={(event) => { setEmail(event.target.value); changed(); }}
                  />
                  <span className="small">Podés usar el correo de tu cuenta o escribir otro.</span>
                </label>
              ) : (
                <label>
                  Tu número de WhatsApp
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+5491155555555"
                    required
                    value={phone}
                    disabled={busy || !!sent}
                    onChange={(event) => { setPhone(event.target.value); changed(); }}
                  />
                  <span className="small">Incluí el código de país (por ejemplo, +54 9 11...).</span>
                </label>
              )}
            </fieldset>
            <label className="photo-quote-consent">
              <input
                type="checkbox"
                required
                checked={consent}
                disabled={busy || !!sent}
                onChange={(event) => { setConsent(event.target.checked); changed(); }}
              />
              <span>Acepto que Somos Mundo 3D use este contacto únicamente para responder mi solicitud de presupuesto.</span>
            </label>
            <p className="small">La imagen es una referencia. Revisaremos si es posible imprimir el diseño antes de confirmar el precio. Enviar la solicitud no confirma una compra.</p>
            <button className="primary" type="submit" disabled={busy || !file || !!sent}>
              {busy ? 'Enviando solicitud…' : sent ? 'Solicitud enviada' : 'Solicitar presupuesto'}
            </button>
            {error && <p className="error" role="alert">{error}</p>}
            {sent && (
              <p className="notice" role="status">
                Solicitud #{String(sent._id).slice(-6).toUpperCase()} recibida. Podés consultar el estado y la respuesta más abajo.
              </p>
            )}
          </form>
          <PhotoQuotes refresh={refresh} />
        </>
      )}
    </section>
  );
}
