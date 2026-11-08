import { useRef, useState } from 'react';
import {
  estimateQuote,
  readSlicedQuote,
  filamentPrices,
} from './quote-estimate.js';
const money = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
export default function DesignQuote() {
  const [mode, setMode] = useState('file');
  const [material, setMaterial] = useState('PLA');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  function changeMode(value) {
    request.current++;
    setMode(value);
    setResult(null);
    setError('');
    setBusy(false);
  }
  async function readFile(file) {
    const id = ++request.current;
    setResult(null);
    setError('');
    if (!file) return;
    if (
      !/\.3mf$/i.test(file.name) ||
      !file.size ||
      file.size > 50 * 1024 * 1024
    ) {
      setError('Elegí un archivo .3mf laminado de hasta 50 MiB.');
      return;
    }
    setBusy(true);
    try {
      const data = readSlicedQuote(await file.arrayBuffer());
      if (id === request.current)
        setResult({
          ...data,
          price: estimateQuote(data.grams, data.hours),
          name: file.name,
        });
    } catch (e) {
      if (id === request.current)
        setError(
          e.message ||
            'No pudimos leer el archivo laminado. Probá la opción manual.',
        );
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  return (
    <section className="design-quote" aria-labelledby="quote-title">
      <p className="eyebrow">COTIZÁ TU IDEA</p>
      <h2 id="quote-title">Calculá tu presupuesto</h2>
      <p>
        Podés usar los datos de un archivo ya laminado o ingresarlos
        manualmente. Para varias piezas o placas, se calcula un solo presupuesto
        con el consumo y el tiempo totales.
      </p>
      <div
        className="quote-options"
        role="group"
        aria-label="Método de presupuesto"
      >
        <button
          type="button"
          className={mode === 'file' ? 'primary' : 'outline'}
          aria-pressed={mode === 'file'}
          onClick={() => changeMode('file')}
        >
          Presupuesto automático
        </button>
        <button
          type="button"
          className={mode === 'manual' ? 'primary' : 'outline'}
          aria-pressed={mode === 'manual'}
          onClick={() => changeMode('manual')}
        >
          Presupuesto manual
        </button>
      </div>
      {mode === 'file' ? (
        <div>
          <h3>Subí tu archivo laminado</h3>
          <p>
            Elegí un .3mf exportado después de laminar en Bambu Studio. Debe
            incluir los gramos totales y el tiempo estimado de todas las placas
            que querés cotizar.
          </p>
          <label>
            Archivo 3MF laminado
            <input
              type="file"
              accept=".3mf"
              disabled={busy}
              onChange={(e) => {
                readFile(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </label>
          <p className="small">
            No se lamina el modelo desde esta página: se leen las estadísticas
            ya guardadas. Un STL, GLB o 3MF sin laminar no permite calcular
            automáticamente el consumo. El archivo se procesa en tu navegador.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setResult(null);
            setError('');
            const data = new FormData(e.currentTarget);
            const grams = Number(data.get('grams')),
              hours =
                Number(data.get('hours')) + Number(data.get('minutes')) / 60;
            try {
              setResult({
                grams,
                hours,
                material,
                price: estimateQuote(grams, hours, material),
              });
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <h3>Ingresá los totales del laminado</h3>
          <p>
            Incluí el material de las piezas, soportes, purgas y torre. Sumá el
            tiempo y los gramos de todas las placas; no multipliques nuevamente
            por la cantidad de piezas.
          </p>
          <label>
            Tipo de filamento
            <select
              value={material}
              onChange={(e) => {
                setMaterial(e.target.value);
                setResult(null);
                setError('');
              }}
            >
              <option value="PLA">PLA — Decoración y uso general</option>
              <option value="PETG">
                PETG — Piezas funcionales y ambientes húmedos
              </option>
              <option value="TPU">TPU — Flexible</option>
            </select>
          </label>
          <p className="small">
            Material seleccionado: {money(filamentPrices[material])}/kg. El
            tiempo debe corresponder al laminado con ese material.
          </p>
          <div className="quote-inputs">
            <label>
              Filamento total (g)
              <input
                name="grams"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                required
              />
            </label>
            <label>
              Horas de impresión
              <input
                name="hours"
                type="number"
                min="0"
                max="10000"
                step="1"
                defaultValue="0"
                required
              />
            </label>
            <label>
              Minutos adicionales
              <input
                name="minutes"
                type="number"
                min="0"
                max="59"
                step="1"
                defaultValue="0"
                required
              />
            </label>
          </div>
          <button className="primary">Calcular presupuesto</button>
        </form>
      )}
      {busy && <p role="status">Leyendo datos del laminado…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="quote-result" role="status">
          <h3>Presupuesto estimado: {money(result.price)}</h3>
          <p>
            {result.grams.toLocaleString('es-AR', { maximumFractionDigits: 2 })}{' '}
            g en total · {Math.floor(result.hours)} h{' '}
            {Math.round((result.hours % 1) * 60)} min
            {result.plates
              ? ' · ' + result.plates + ' placa(s) laminada(s)'
              : ''}
          </p>
          <p className="small">
            Estimación para {result.material || 'PLA'} con material promedio de{' '}
            {money(filamentPrices[result.material || 'PLA'])}/kg. Incluye una
            preparación estándar de 30 minutos y embalaje básico. Sujeta a
            revisión de impresión, colores y terminación; no incluye envío ni
            componentes adicionales como luces o herrajes.
          </p>
        </div>
      )}
    </section>
  );
}
