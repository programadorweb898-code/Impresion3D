import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { unpackModel } from './model-transfer.js';

const invalid = (message = 'El archivo no contiene un modelo 3D válido.') =>
  new Error(message);

// Keep the original buffer intact: the viewer may be reopened and the original
// File is still used for an explicit budget submission.
function parseInWorker(buffer, format, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException('Cancelado', 'AbortError'));
    let worker,
      timer,
      settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      worker?.terminate();
      if (error) reject(error);
      else resolve(value);
    };
    const cancel = () => finish(new DOMException('Cancelado', 'AbortError'));
    try {
      worker = new Worker(new URL('./local-model.worker.js', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = ({ data }) => {
        if (settled) return;
        if (data.error) return finish(invalid(data.error));
        try {
          finish(null, unpackModel(data));
        } catch {
          finish(invalid());
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        finish(
          invalid('No se pudo procesar el modelo 3D. Volvé a seleccionarlo.'),
        );
      };
      signal?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(
        () =>
          finish(
            invalid(
              'El modelo tarda demasiado en procesarse. Exportá una versión más liviana.',
            ),
          ),
        45000,
      );
      const copy = buffer.slice(0);
      worker.postMessage({ buffer: copy, format }, [copy]);
    } catch {
      finish(
        invalid(
          'Tu navegador no pudo procesar este archivo. Probá con un navegador actualizado.',
        ),
      );
    }
  });
}

export async function parseLocalModel(buffer, format, { signal } = {}) {
  if (format === '3mf' || format === 'stl')
    return parseInWorker(buffer, format, signal);
  const view = new DataView(buffer);
  if (
    buffer.byteLength < 20 ||
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== buffer.byteLength ||
    view.getUint32(16, true) !== 0x4e4f534a
  )
    throw invalid();
  const length = view.getUint32(12, true);
  if (length > 4 * 1024 * 1024 || 20 + length > buffer.byteLength)
    throw invalid();
  const doc = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 20, length)),
  );
  if (
    [...(doc.buffers || []), ...(doc.images || [])].some(
      (v) => v.uri !== undefined,
    )
  )
    throw invalid('El GLB debe incluir todos sus recursos dentro del archivo.');
  if (
    (doc.accessors || []).reduce(
      (sum, a) => sum + (a.type === 'VEC3' ? a.count || 0 : 0),
      0,
    ) > 4500000
  )
    throw invalid('El modelo es demasiado complejo para esta vista.');
  const root = (await new GLTFLoader().parseAsync(buffer, '')).scene;
  const colorStates = [];
  for (const mesh of doc.meshes || [])
    for (const primitive of mesh.primitives || []) {
      const m = doc.materials?.[primitive.material];
      const pbr = m?.pbrMetallicRoughness;
      colorStates.push(
        primitive.attributes?.COLOR_0 !== undefined ||
          pbr?.baseColorFactor !== undefined ||
          pbr?.baseColorTexture !== undefined
          ? 'complete'
          : m?.extensions
            ? 'unknown'
            : 'missing',
      );
    }
  root.userData.colorStatus = colorStates.includes('missing')
    ? 'missing'
    : colorStates.includes('unknown')
      ? 'unknown'
      : 'complete';
  root.scale.multiplyScalar(1000); // glTF uses meters; all local measurements use millimeters.
  return root;
}
