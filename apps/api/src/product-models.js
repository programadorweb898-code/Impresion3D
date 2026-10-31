import multer from 'multer';
import { validateBytes } from 'gltf-validator';
import { threeMfToGlb } from './three-mf.js';
const invalid = (message) =>
  Object.assign(new Error(message), { status: 400, publicModelError: true });
export const maxModelBytes = 10 * 1024 * 1024;
export const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxModelBytes, files: 1, fields: 0, parts: 1 },
}).single('model');
function bounds(points) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length; i++) {
    const value = points[i];
    if (!Number.isFinite(value) || Math.abs(value) > 1e9)
      throw invalid('El STL contiene coordenadas inválidas.');
    const axis = i % 3;
    min[axis] = Math.min(min[axis], value);
    max[axis] = Math.max(max[axis], value);
  }
  if (max.some((v, i) => v <= min[i]))
    throw invalid('El modelo debe tener ancho, alto y profundidad.');
}
function stl(buffer) {
  let triangles = buffer.length >= 84 ? buffer.readUInt32LE(80) : 0;
  if (triangles && 84 + 50 * triangles === buffer.length) {
    if (triangles > 200000)
      throw invalid(
        'El STL supera los 200.000 triángulos. Exportá una versión más liviana.',
      );
    const points = new Float32Array(triangles * 9);
    for (let t = 0; t < triangles; t++)
      for (let n = 0; n < 9; n++)
        points[t * 9 + n] = buffer.readFloatLE(84 + t * 50 + 12 + n * 4);
    bounds(points);
    return buffer;
  }
  const text = buffer.toString('utf8');
  if (!/^\s*solid\b/i.test(text) || !/endsolid\b/i.test(text))
    throw invalid('El archivo STL no es válido.');
  const facets = [...text.matchAll(/facet\s+normal\s+[\s\S]*?endfacet/gi)];
  if (!facets.length || facets.length > 200000)
    throw invalid(
      'El STL no tiene geometría válida o supera los 200.000 triángulos.',
    );
  const points = [];
  for (const facet of facets) {
    const vertices = [
      ...facet[0].matchAll(/\bvertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/gi),
    ];
    if (vertices.length !== 3)
      throw invalid('El STL contiene caras inválidas.');
    for (const v of vertices)
      points.push(Number(v[1]), Number(v[2]), Number(v[3]));
  }
  bounds(points);
  triangles = facets.length;
  const binary = Buffer.alloc(84 + 50 * triangles);
  binary.write('Impresion3D STL');
  binary.writeUInt32LE(triangles, 80);
  for (let t = 0; t < triangles; t++)
    for (let n = 0; n < 9; n++)
      binary.writeFloatLE(points[t * 9 + n], 84 + t * 50 + 12 + n * 4);
  return binary;
}
async function glb(buffer) {
  if (
    buffer.length < 20 ||
    buffer.toString('ascii', 0, 4) !== 'glTF' ||
    buffer.readUInt32LE(4) !== 2 ||
    buffer.readUInt32LE(8) !== buffer.length ||
    buffer.readUInt32LE(16) !== 0x4e4f534a
  )
    throw invalid('El archivo GLB no es válido.');
  const length = buffer.readUInt32LE(12);
  if (length > 2 * 1024 * 1024 || 20 + length > buffer.length)
    throw invalid(
      'El GLB contiene una estructura inválida o demasiado grande.',
    );
  let doc;
  try {
    doc = JSON.parse(buffer.toString('utf8', 20, 20 + length).trim());
  } catch {
    throw invalid('El GLB contiene datos inválidos.');
  }
  if (
    !doc ||
    typeof doc !== 'object' ||
    [
      'buffers',
      'images',
      'meshes',
      'accessors',
      'nodes',
      'extensionsUsed',
      'extensionsRequired',
    ].some((key) => doc[key] !== undefined && !Array.isArray(doc[key]))
  )
    throw invalid('El GLB contiene una estructura inválida.');
  if ((doc.nodes?.length || 0) > 10000)
    throw invalid(
      'El GLB tiene demasiados objetos. Exportá una versión más simple.',
    );
  const resources = [...(doc.buffers || []), ...(doc.images || [])];
  if (resources.some((r) => r.uri !== undefined))
    throw invalid(
      'El GLB debe incluir todos sus recursos dentro del archivo, sin URLs ni archivos externos.',
    );
  if (
    [...(doc.extensionsRequired || []), ...(doc.extensionsUsed || [])].some(
      (x) =>
        [
          'KHR_draco_mesh_compression',
          'EXT_meshopt_compression',
          'KHR_texture_basisu',
        ].includes(x),
    )
  )
    throw invalid(
      'Exportá un GLB sin compresión Draco, Meshopt ni texturas KTX2.',
    );
  let vertices = 0,
    triangles = 0;
  for (const mesh of doc.meshes || []) {
    if (!mesh || !Array.isArray(mesh.primitives))
      throw invalid('El GLB contiene una estructura inválida.');
    for (const primitive of mesh.primitives) {
      if (!primitive || (primitive.mode !== undefined && primitive.mode !== 4))
        throw invalid('El GLB debe contener mallas de triángulos.');
      const count = doc.accessors?.[primitive.attributes?.POSITION]?.count || 0;
      vertices += count;
      triangles += (doc.accessors?.[primitive.indices]?.count || count) / 3;
    }
  }
  if (!vertices || vertices > 1000000 || triangles > 300000)
    throw invalid(
      'El GLB no tiene geometría o es demasiado complejo. Usá hasta 300.000 triángulos.',
    );
  let report;
  try {
    report = await validateBytes(new Uint8Array(buffer), {
      maxIssues: 10,
      externalResourceFunction: () =>
        Promise.reject(new Error('External resources are disabled')),
    });
  } catch {
    throw invalid('No se pudo validar el modelo GLB.');
  }
  if (report.issues.numErrors)
    throw invalid(
      'El GLB tiene errores de geometría o estructura. Volvé a exportarlo.',
    );
  return buffer;
}
export async function validateProductModel(file) {
  if (!file?.buffer?.length)
    throw invalid('Seleccioná un archivo GLB, STL o 3MF.');
  if (file.buffer.length > maxModelBytes)
    throw invalid('El modelo supera el límite de 10 MiB.');
  const format = file.originalname?.split('.').pop().toLowerCase();
  if (format === '3mf') {
    const converted = await threeMfToGlb(file.buffer);
    await glb(converted.buffer);
    return converted;
  }
  if (format === 'stl') return { buffer: stl(file.buffer), format };
  if (format === 'glb') return { buffer: await glb(file.buffer), format };
  throw invalid('Usá un archivo GLB, STL o 3MF.');
}
