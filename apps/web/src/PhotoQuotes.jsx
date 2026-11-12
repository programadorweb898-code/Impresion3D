import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Pagination } from './Pagination.jsx';

const statuses = {
  recibido: 'Recibida',
  en_revision: 'En revisión',
  presupuestado: 'Presupuestada',
  cerrado: 'Cerrada',
};
const money = (cents) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
    .format(cents / 100);

function replyUrl(row) {
  if (!row.contact?.value || !(row.priceCents > 0) || row.status !== 'presupuestado')
    return '';
  const name = row.customer?.name ? ' ' + row.customer.name : '';
  const reference = String(row._id).slice(-6).toUpperCase();
  const body = 'Hola' + name + ', somos Somos Mundo 3D. Te respondemos por tu solicitud #' +
    reference + '.\nPresupuesto total: ' + money(row.priceCents) + '.\n' +
    (row.response || '') + '\n\nSi tenés dudas, escribinos.';
  if (row.contact.method === 'email') {
    const subject = 'Presupuesto Somos Mundo 3D #' + reference;
    return 'mailto:' + encodeURIComponent(row.contact.value)
      + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  if (row.contact.method === 'whatsapp') {
    const digits = row.contact.value.replace(/\D/g, '');
    if (!/^[1-9]\d{7,14}$/.test(digits)) return '';
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(body);
  }
  return '';
}

function QuoteRow({ row, admin, onSave, busy }) {
  const [status, setStatus] = useState(row.status);
  const [price, setPrice] = useState(row.priceCents == null ? '' : String(row.priceCents / 100));
  const [response, setResponse] = useState(row.response || '');
  const link = admin ? replyUrl(row) : '';
  const photoUrl = '/api/photo-quotes/' + row._id + '/image';
  return (
    <article className="order photo-quote-row">
      <h3>Solicitud #{String(row._id).slice(-6).toUpperCase()}</h3>
      <p>{statuses[row.status]} · {new Date(row.createdAt).toLocaleString('es-AR')}</p>
      {admin && <p><strong>Cliente:</strong> {row.customer?.name || 'Cuenta no disponible'} · {row.customer?.email || 'Sin email en la cuenta'}</p>}
      <div className="photo-quote-row-layout">
        <a href={photoUrl} target="_blank" rel="noopener noreferrer" title="Abrir imagen de referencia">
          <img src={photoUrl} alt="Imagen de referencia enviada por el cliente" loading="lazy" className="photo-quote-thumb" />
        </a>
        <div>
          <p><strong>Cantidad:</strong> {row.quantity}</p>
          {row.approximateSize && <p><strong>Tamaño aproximado:</strong> {row.approximateSize}</p>}
          {row.details && <p className="photo-quote-details"><strong>Detalles:</strong> {row.details}</p>}
          <p><strong>Respuesta elegida:</strong> {row.contact?.method === 'whatsapp' ? 'WhatsApp' : 'Correo electrónico'} · {row.contact?.value}</p>
          {row.priceCents != null && <p><strong>Presupuesto total: {money(row.priceCents)}</strong></p>}
          {row.response && <p className="request-response"><strong>Respuesta:</strong> {row.response}</p>}
        </div>
      </div>
      {admin && (
        <>
          <form onSubmit={(event) => {
            event.preventDefault();
            onSave(row._id, {
              status,
              priceCents: price === '' ? null : Math.round(Number(price) * 100),
              response,
              version: row.__v,
            });
          }}>
            <label>
              Estado
              <select value={status} disabled={busy} onChange={(event) => setStatus(event.target.value)}>
                {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label>
              Presupuesto total (ARS)
              <input type="number" min="0" max="10000000" step="0.01" value={price}
                disabled={busy} onChange={(event) => setPrice(event.target.value)} />
            </label>
            <label>
              Respuesta y condiciones
              <textarea value={response} maxLength={2000} rows={3} disabled={busy}
                onChange={(event) => setResponse(event.target.value)} />
            </label>
            <button type="submit" disabled={busy}>Guardar presupuesto</button>
          </form>
          {link && (
            <div className="photo-quote-reply">
              <a className="primary" href={link} target="_blank" rel="noopener noreferrer">
                Responder por {row.contact.method === 'email' ? 'email' : 'WhatsApp'}
              </a>
              <p className="small">Se abre un mensaje con los últimos datos guardados. Revisalo y presioná enviar; no se envía automáticamente.</p>
            </div>
          )}
        </>
      )}
    </article>
  );
}

export default function PhotoQuotes({ admin = false, refresh = 0 }) {
  const [data, setData] = useState({ requests: [], page: 1, pages: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load(page = 1) {
    setBusy(true);
    setError('');
    try {
      setData(await api((admin ? '/admin' : '') + '/photo-quotes?page=' + page));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { void load(); }, [admin, refresh]);
  async function save(id, body) {
    setBusy(true);
    setError('');
    try {
      await api('/admin/photo-quotes/' + id, { method: 'PATCH', body: JSON.stringify(body) });
      await load(data.page);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="photo-quote-list" aria-labelledby={admin ? 'admin-photo-quotes' : 'my-photo-quotes'}>
      <h2 id={admin ? 'admin-photo-quotes' : 'my-photo-quotes'}>
        {admin ? 'Solicitudes de presupuestos por imagen' : 'Mis solicitudes de presupuesto'}
      </h2>
      <button className="outline" type="button" disabled={busy} onClick={() => load(data.page)}>Actualizar solicitudes</button>
      {error && <p role="alert" className="error">{error}</p>}
      {busy && <p role="status">Cargando solicitudes…</p>}
      <div className="photo-quote-items">
        {data.requests.map((row) => (
          <QuoteRow key={row._id + ':' + row.__v} row={row} admin={admin} busy={busy} onSave={save} />
        ))}
      </div>
      {!busy && !error && !data.requests.length && <p>Todavía no hay solicitudes por imagen.</p>}
      <Pagination page={data.page} pages={data.pages} busy={busy} onPage={load} />
    </section>
  );
}
