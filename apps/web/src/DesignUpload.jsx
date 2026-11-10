import { useCallback, useRef, useState } from 'react';
import ProductViewer from './ProductViewer.jsx';
import DesignRequestForm from './DesignRequestForm.jsx';
import { pieceNameInSpanish } from './piece-names.js';

const maxBytes = 50 * 1024 * 1024;
const centimeters = (mm) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(mm / 10) +
  ' cm';

export default function DesignUpload() {
  const input = useRef(null);
  const selection = useRef(0);
  const [originalFile, setOriginalFile] = useState(null);
  const [product, setProduct] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const measured = useCallback((value) => setDimensions(value), []);
  const failed = useCallback((message) => setError(message), []);

  async function select(files) {
    const version = ++selection.current;
    setProduct(null);
    setOriginalFile(null);
    setDimensions(null);
    setError('');
    setLoading(false);
    if (files.length !== 1) {
      setError('Elegí un solo archivo para visualizar.');
      return;
    }
    const file = files[0];
    const format = file.name.split('.').pop().toLowerCase();
    if (!['3mf', 'stl', 'glb'].includes(format)) {
      setError('El archivo debe ser .3mf, .stl o .glb.');
      return;
    }
    if (!file.size || file.size > maxBytes) {
      setError('Elegí un archivo de hasta 50 MiB que no esté vacío.');
      return;
    }
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      if (version !== selection.current) return;
      setOriginalFile(file);
      setProduct({
        name: file.name,
        model: { url: 'local:' + version, format, buffer },
      });
    } catch {
      if (version === selection.current)
        setError('No pudimos leer el archivo. Volvé a seleccionarlo.');
    } finally {
      if (version === selection.current) setLoading(false);
    }
  }

  return (
    <section className="design-page" aria-labelledby="design-title">
      <p className="eyebrow">DE TU ARCHIVO A UNA IDEA REAL</p>
      <h1 id="design-title">Subí tu diseño</h1>
      <p>
        Explorá tu modelo en 3D y conocé sus medidas antes de dar el próximo
        paso.
      </p>
      <div
        className={'design-dropzone' + (dragging ? ' is-dragging' : '')}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          select(event.dataTransfer.files);
        }}
      >
        <span className="design-upload-icon" aria-hidden="true">
          ↑
        </span>
        <h2>Arrastrá tu archivo acá</h2>
        <p>o elegilo desde tu dispositivo</p>
        <input
          ref={input}
          id="design-file"
          type="file"
          accept=".3mf,.stl,.glb"
          aria-label="Archivo de diseño 3D"
          onChange={(event) => {
            if (event.target.files.length) select(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          className="primary"
          type="button"
          onClick={() => input.current?.click()}
        >
          {product ? 'Elegir otro archivo' : 'Elegir archivo'}
        </button>
        <p className="small">3MF, STL o GLB · Hasta 50 MiB</p>
      </div>
      <p className="small">
        La vista previa se procesa en tu navegador. El archivo solo se guarda
        cuando enviás una solicitud de presupuesto.
      </p>
      {loading && <p role="status">Leyendo archivo…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {product ? (
        <div className="design-section">
          {dimensions?.componentCount > 1 && (
            <div className="design-parts-notice" role="status">
              <strong>Este archivo contiene varias piezas.</strong> Se muestran
              en las posiciones originales del archivo. Si aparecen separadas,
              subí una versión ensamblada para visualizar el producto completo.
              Las medidas del conjunto incluyen los espacios entre piezas y no
              representan necesariamente el tamaño final ensamblado. Más abajo
              podés consultar las medidas de cada pieza.
            </div>
          )}
          <h2>Vista 3D</h2>
          <div className="design-layout">
            <div className="design-preview">
              <ProductViewer
                key={product.model.url}
                product={product}
                onMeasurements={measured}
                onLoadError={failed}
              />
            </div>
            <aside
              className="design-measurements"
              aria-label="Información del modelo"
            >
              <p className="eyebrow">TU MODELO</p>
              <h2>{product.name}</h2>
              <p className="small">
                Formato {product.model.format.toUpperCase()}
              </p>
              <h3>
                {dimensions?.componentCount > 1
                  ? 'Medidas del conjunto del archivo'
                  : 'Medidas del modelo'}
              </h3>
              {dimensions ? (
                <dl className="product-detail-dimensions">
                  {['width', 'height', 'depth'].map((key, index) => (
                    <div key={key}>
                      <dt>{['Ancho', 'Alto', 'Profundidad'][index]}</dt>
                      <dd>{centimeters(dimensions[key])}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>
                  {error ? 'Medidas no disponibles.' : 'Calculando medidas…'}
                </p>
              )}
              {dimensions?.parts.length > 1 && (
                <div className="design-parts">
                  <h3>Medidas de cada pieza</h3>
                  <div
                    className="design-parts-table-wrap"
                    tabIndex="0"
                    role="region"
                    aria-label="Medidas de cada pieza"
                  >
                    <table className="design-parts-table">
                      <caption>
                        {dimensions.parts.length} piezas · Medidas en
                        centímetros
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Pieza</th>
                          <th scope="col">Ancho</th>
                          <th scope="col">Alto</th>
                          <th scope="col">Prof.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dimensions.parts.map((part, index) => (
                          <tr key={index}>
                            <th scope="row">
                              {pieceNameInSpanish(part.name, index + 1)}
                            </th>
                            <td>{centimeters(part.width)}</td>
                            <td>{centimeters(part.height)}</td>
                            <td>{centimeters(part.depth)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="small">
                    Cada pieza se mide por separado, sin incluir la distancia a
                    las demás. Estas medidas no determinan el tamaño final
                    ensamblado.
                  </p>
                </div>
              )}
              <p className="small">
                Las medidas corresponden al conjunto y a la orientación del
                archivo. En STL se interpretan las unidades como milímetros.
              </p>
            </aside>
          </div>
        </div>
      ) : (
        !loading &&
        !error && (
          <p className="design-empty">
            Tu modelo y sus medidas aparecerán acá cuando elijas un archivo.
          </p>
        )
      )}
      <DesignRequestForm
        file={originalFile}
        dimensions={error ? null : dimensions}
      />
    </section>
  );
}
