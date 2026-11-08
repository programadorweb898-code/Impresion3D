import { unzipSync, strFromU8 } from 'three/addons/libs/fflate.module.js';
export function estimateQuote(grams, hours) {
  if (
    !Number.isFinite(grams) ||
    !Number.isFinite(hours) ||
    grams <= 0 ||
    grams > 100000 ||
    hours <= 0 ||
    hours > 10000
  )
    throw new Error(
      'Ingresá gramos y tiempo mayores que cero, dentro de los límites permitidos.',
    );
  // Initial adjustable business assumptions: ARS 23/g, machine 800/h,
  // electricity 100/h, 30 minutes labor at 5000/h, packaging 500,
  // 10% contingency and 75% markup on total cost.
  return (
    Math.ceil(((grams * 23 + hours * 900 + 3000) * 1.1 * 1.75) / 100) * 100
  );
}
export function readSlicedQuote(buffer) {
  let size = 0;
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (file) => {
      if (file.name !== 'Metadata/slice_info.config') return false;
      size += file.originalSize;
      if (size > 2 * 1024 * 1024)
        throw new Error('Los datos de laminado superan el límite permitido.');
      return true;
    },
  });
  const bytes = files['Metadata/slice_info.config'];
  if (!bytes)
    throw new Error(
      'No encontramos datos de laminado. Exportá el archivo laminado desde Bambu Studio o usá el presupuesto manual.',
    );
  const text = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('El archivo contiene datos no permitidos.');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror'))
    throw new Error('No se pudieron leer los datos del archivo.');
  const plates = [...xml.querySelectorAll('plate')];
  if (!plates.length)
    throw new Error(
      'El archivo no contiene placas laminadas. Exportá el resultado del laminado o usá el presupuesto manual.',
    );
  let grams = 0,
    seconds = 0;
  for (const plate of plates) {
    const metadata = Object.fromEntries(
      [...plate.querySelectorAll(':scope > metadata')].map((m) => [
        m.getAttribute('key'),
        m.getAttribute('value'),
      ]),
    );
    const filaments = [...plate.querySelectorAll('filament')];
    const weight = filaments.length
      ? filaments.reduce((sum, f) => sum + Number(f.getAttribute('used_g')), 0)
      : Number(metadata.weight);
    const time = Number(metadata.prediction);
    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isFinite(time) ||
      time <= 0
    )
      throw new Error(
        'Faltan gramos o tiempo en una placa. Para no cotizar un trabajo incompleto, usá el presupuesto manual con los totales.',
      );
    grams += weight;
    seconds += time;
  }
  estimateQuote(grams, seconds / 3600);
  return { grams, hours: seconds / 3600, plates: plates.length };
}
