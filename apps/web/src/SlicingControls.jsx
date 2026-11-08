import { useEffect, useState } from 'react';
import { api } from './api.js';
import { estimateQuote } from './quote-estimate.js';
export function WorkerConnections() {
  const [workers, setWorkers] = useState([]),
    [name, setName] = useState('Mi PC'),
    [code, setCode] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const data = await api('/admin/slicing/workers');
      setWorkers(data.workers);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/admin/slicing/workers', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setCode(data);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id) {
    setBusy(true);
    setError('');
    try {
      await api('/admin/slicing/workers/' + id, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="slicer-connections">
      <h2>Laminado en tu PC</h2>
      <p>
        Vinculá una PC con Bambu Studio y perfiles completos de tu Bambu A1. Las
        solicitudes quedan en cola hasta que el proceso local esté conectado.
        Los resultados son estimaciones para revisar; la impresión se inicia por
        separado.
      </p>
      <details>
        <summary>Cómo conectar la PC</summary>
        <ol>
          <li>
            En tu PC, descargá el{' '}
            <a href="/api/slicer-worker/download" download>
              asistente Mundo 3D
            </a>{' '}
            y el{' '}
            <a href="/api/slicer-worker/example" download>
              ejemplo de perfiles
            </a>
            .
          </li>
          <li>
            Configurá las rutas de tus perfiles completos de máquina, proceso y
            filamentos en el JSON de ejemplo. Deben corresponder a tu A1 y a su
            boquilla. No se usan los ajustes de impresora del cliente.
          </li>
          <li>
            Con Node.js 24 o posterior instalado, abrí la terminal en Descargas
            y ejecutá <code>node mundo3d-worker.mjs setup</code>. Elegí Bambu
            Studio y el JSON de perfiles, y pegá el código generado abajo.
          </li>
          <li>
            Ejecutá <code>node mundo3d-worker.mjs start</code> y mantené la
            ventana abierta. La primera prueba con un archivo conocido debe
            coincidir con tu laminado manual antes de usar las cifras para
            presupuestar.
          </li>
        </ol>
        <p className="small">
          Esta versión procesa STL sin color y proyectos 3MF de Bambu con hasta
          cuatro filamentos del mismo material. Los GLB y los formatos de color
          que requieren conversión se revisan manualmente. El cálculo de
          cantidades corresponde a copias impresas por separado.
        </p>
      </details>
      <form onSubmit={create}>
        <label>
          Nombre de la PC
          <input
            required
            maxLength="60"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          Generar código de conexión
        </button>
      </form>
      {code && (
        <p role="status">
          Código de vinculación:{' '}
          <strong className="pairing-code">{code.code}</strong>. Vence en 10
          minutos y se usa una sola vez. Pegalo únicamente en el asistente de tu
          PC.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="outline" disabled={busy} onClick={load}>
        Actualizar conexiones
      </button>
      <ul>
        {workers.map((w) => (
          <li key={w._id}>
            <strong>{w.name}</strong> ·{' '}
            {w.revoked
              ? 'Desconectada'
              : w.lastSeenAt
                ? 'Última conexión: ' +
                  new Date(w.lastSeenAt).toLocaleString('es-AR')
                : 'Pendiente de vincular'}{' '}
            {!w.revoked && (
              <button
                className="outline"
                disabled={busy}
                onClick={() => revoke(w._id)}
              >
                Desconectar {w.name}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
const states = {
  queued: 'En cola',
  processing: 'Laminando',
  complete: 'Laminado recibido',
  failed: 'Requiere revisión',
};
export function RequestSlicing({
  row,
  onRefresh,
  onEstimate,
  availableWorkers = [],
}) {
  const [choice, setChoice] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const workers = availableWorkers.filter(
    (w) => !w.revoked && w.profiles.length,
  );
  const load = () => onRefresh();
  const job = row.slicing,
    active = ['queued', 'processing'].includes(job?.state);
  const profiles = workers.flatMap((w) =>
    w.profiles.map((p) => ({
      value: w._id + ':' + p.id,
      label: w.name + ' · ' + p.name,
    })),
  );
  async function queue() {
    const [workerId, profileId] = choice.split(':');
    if (!workerId || !profileId) return;
    setBusy(true);
    setError('');
    try {
      await api('/admin/slicing/requests/' + row._id, {
        method: 'POST',
        body: JSON.stringify({ workerId, profileId }),
      });
      await onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="request-slicing"
      aria-label={'Laminado de ' + row.filename}
    >
      <h4>Laminado para presupuesto</h4>
      {job && (
        <p role="status">
          {states[job.state]} · {job.profileName}
          {job.error && ' · ' + job.error}
        </p>
      )}
      {job?.state === 'complete' && job.result && (
        <>
          <p>
            Una copia completa del archivo:{' '}
            {job.result.grams.toLocaleString('es-AR', {
              maximumFractionDigits: 2,
            })}{' '}
            g ·{' '}
            {(job.result.seconds / 3600).toLocaleString('es-AR', {
              maximumFractionDigits: 2,
            })}{' '}
            h · {job.result.plates} placa(s).
          </p>
          <p>
            Para {row.quantity} copias independientes:{' '}
            {(job.result.grams * row.quantity).toLocaleString('es-AR', {
              maximumFractionDigits: 2,
            })}{' '}
            g y{' '}
            {((job.result.seconds * row.quantity) / 3600).toLocaleString(
              'es-AR',
              { maximumFractionDigits: 2 },
            )}{' '}
            h estimadas. Revisá la orientación, soportes, colores y purgas. No
            se optimiza la impresión de varias copias juntas.
          </p>
          <button
            type="button"
            className="outline"
            onClick={() => {
              try {
                onEstimate(
                  estimateQuote(
                    job.result.grams * row.quantity,
                    (job.result.seconds * row.quantity) / 3600,
                    job.material,
                  ),
                );
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Usar estimación como borrador de precio
          </button>
        </>
      )}
      {!['3mf', 'stl'].includes(row.format) ? (
        <p>Este GLB requiere preparación manual en el laminador.</p>
      ) : (
        <>
          <label>
            PC y perfil de laminado
            <select
              aria-label={'Perfil para ' + row.filename}
              value={choice}
              disabled={active || busy || row.status === 'cerrado'}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">Elegí un perfil configurado</option>
              {profiles.map((p) => (
                <option value={p.value} key={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="quote-options">
            <button
              type="button"
              className="outline"
              disabled={busy || active || !choice || row.status === 'cerrado'}
              onClick={queue}
            >
              {busy
                ? 'Encolando…'
                : job
                  ? 'Volver a laminar en mi PC'
                  : 'Laminar en mi PC'}
            </button>
            <button type="button" className="outline" onClick={load}>
              Actualizar perfiles de PC
            </button>
          </div>
          {!profiles.length && (
            <p className="small">
              Primero vinculá la PC y sus perfiles en «Laminado en tu PC».
            </p>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="small">
        El resultado no se envía al cliente hasta que guardes tu respuesta y
        precio. Usá «Actualizar solicitudes» para consultar el avance.
      </p>
    </section>
  );
}
