import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Pagination } from './Pagination.jsx';
export const requestStatuses = {
  recibido: 'Recibida',
  en_revision: 'En revisión',
  presupuestado: 'Presupuestada',
  cerrado: 'Cerrada',
};
const money = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
    n / 100,
  );
function RequestRow({ row, admin, onSave }) {
  const [status, setStatus] = useState(row.status),
    [price, setPrice] = useState(
      row.priceCents === null ? '' : String(row.priceCents / 100),
    ),
    [response, setResponse] = useState(row.response || '');
  return (
    <article className="order design-request-row">
      <h3>
        Solicitud #{row._id.slice(-6).toUpperCase()} · {row.filename}
      </h3>
      <p>
        {requestStatuses[row.status]} ·{' '}
        {new Date(row.createdAt).toLocaleString('es-AR')}
      </p>
      {admin && (
        <p>
          {row.customer?.name || 'Cuenta no disponible'} ·{' '}
          {row.customer?.email || 'Sin correo'}
        </p>
      )}
      <p>
        {row.quantity} unidad(es) ·{' '}
        {['width', 'height', 'depth']
          .map((k) =>
            (row.dimensions[k] / 10).toLocaleString('es-AR', {
              maximumFractionDigits: 2,
            }),
          )
          .join(' × ')}{' '}
        cm · Escala {Number(row.scale.toFixed(4))}×
      </p>
      <p>
        {row.colorStatus === 'complete'
          ? 'Colores asignados según el análisis del archivo.'
          : row.colorStatus === 'missing'
            ? 'Hay partes sin color asignado.'
            : 'No se pudieron verificar todos los colores del archivo.'}
        {row.acceptedMissingColor &&
          ' El cliente aceptó enviarlo para revisión.'}
      </p>
      {row.usage && <p>Uso: {row.usage}</p>}
      {row.priceCents !== null && (
        <p>
          <strong>Presupuesto total: {money(row.priceCents)}</strong>
        </p>
      )}
      {row.response && (
        <p className="request-response">Respuesta: {row.response}</p>
      )}
      <a
        className="outline"
        href={'/api/design-requests/' + row._id + '/file'}
        download
      >
        Descargar archivo original
      </a>
      {admin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(row._id, {
              status,
              priceCents: price === '' ? null : Math.round(Number(price) * 100),
              response,
              version: row.__v,
            });
          }}
        >
          <label>
            Estado de solicitud
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(requestStatuses).map(([s, label]) => (
                <option value={s} key={s}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Presupuesto total (ARS)
            <input
              type="number"
              min="0"
              max="10000000"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label>
            Respuesta al cliente
            <textarea
              maxLength="2000"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
          </label>
          <p className="small">
            El precio corresponde a toda la cantidad solicitada. La respuesta
            queda visible para el cliente en esta página.
          </p>
          <button className="primary">Guardar respuesta</button>
        </form>
      )}
    </article>
  );
}
export default function DesignRequests({ admin = false, refresh = 0 }) {
  const [data, setData] = useState({ requests: [], page: 1, pages: 1 }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load(page = 1) {
    setBusy(true);
    setError('');
    try {
      setData(
        await api((admin ? '/admin' : '') + '/design-requests?page=' + page),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [admin, refresh]);
  async function save(id, body) {
    setBusy(true);
    setError('');
    try {
      await api('/admin/design-requests/' + id, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await load(data.page);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="design-request-list" aria-labelledby="requests-title">
      <h2 id="requests-title">
        {admin
          ? 'Solicitudes de presupuesto'
          : 'Mis solicitudes de presupuesto'}
      </h2>
      <button
        className="outline"
        disabled={busy}
        onClick={() => load(data.page)}
      >
        Actualizar solicitudes
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">Actualizando solicitudes…</p>}
      <fieldset disabled={busy}>
        {data.requests.map((row) => (
          <RequestRow
            key={row._id + ':' + row.__v}
            row={row}
            admin={admin}
            onSave={save}
          />
        ))}
      </fieldset>
      {!busy && !error && !data.requests.length && (
        <p>Todavía no hay solicitudes.</p>
      )}
      <Pagination
        page={data.page}
        pages={data.pages}
        busy={busy}
        onPage={load}
      />
    </section>
  );
}
