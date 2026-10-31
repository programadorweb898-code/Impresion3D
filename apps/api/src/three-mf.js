import yauzl from 'yauzl';
import path from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
const bad = (message) =>
  Object.assign(new Error(message), { status: 400, publicModelError: true });
const limit = 32 * 1024 * 1024;
const arrayTags = new Set([
  'object',
  'vertex',
  'triangle',
  'component',
  'base',
  'color',
  'basematerials',
  'colorgroup',
  'item',
  'metadata',
  'part',
  'Relationship',
]);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (tag) => arrayTags.has(tag),
});
function xml(buffer) {
  const text = buffer.toString('utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true)
    throw bad('El 3MF contiene XML inválido o no permitido.');
  try {
    return parser.parse(text);
  } catch {
    throw bad('No se pudo leer la estructura del 3MF.');
  }
}
function packagePath(target, from = '') {
  if (
    typeof target !== 'string' ||
    !target ||
    /[\\?#]/.test(target) ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  )
    throw bad('El 3MF contiene referencias externas o inválidas.');
  const resolved = path.posix.normalize(
    target.startsWith('/')
      ? target.slice(1)
      : path.posix.join(path.posix.dirname(from), target),
  );
  if (resolved.startsWith('../') || resolved === '..')
    throw bad('El 3MF contiene rutas fuera del archivo.');
  return resolved;
}
function readArchive(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error) return reject(bad('El archivo 3MF no es un ZIP válido.'));
        const files = new Map();
        let entries = 0,
          total = 0,
          finished = false;
        const fail = () => {
          if (finished) return;
          finished = true;
          zip.close();
          reject(
            bad('El 3MF es inválido o supera los límites de descompresión.'),
          );
        };
        zip.on('error', fail);
        zip.on('end', () => {
          if (!finished) {
            finished = true;
            resolve(files);
          }
        });
        zip.on('entry', (entry) => {
          if (
            ++entries > 1000 ||
            entry.fileName.includes('\\') ||
            entry.fileName.startsWith('/') ||
            entry.fileName.split('/').includes('..') ||
            entry.generalPurposeBitFlag & 1
          )
            return fail();
          const key = entry.fileName;
          if (!(
            /\.model$/i.test(key) ||
            key === '_rels/.rels' ||
            /^Metadata\/(model_settings|project_settings)\.config$/i.test(key)
          ))
            return zip.readEntry();
          if (
            files.has(key) ||
            entry.uncompressedSize > 16 * 1024 * 1024 ||
            (total += entry.uncompressedSize) > limit
          )
            return fail();
          zip.openReadStream(entry, (error, stream) => {
            if (error) return fail();
            const chunks = [];
            let bytes = 0;
            stream.on('error', fail);
            stream.on('data', (chunk) => {
              bytes += chunk.length;
              if (bytes > entry.uncompressedSize || bytes > 16 * 1024 * 1024) {
                stream.destroy();
                fail();
              } else chunks.push(chunk);
            });
            stream.on('end', () => {
              if (finished) return;
              files.set(key, Buffer.concat(chunks));
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
const integer = (value, max = 2147483647) => {
  if (
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > max
  )
    throw bad('El 3MF contiene índices inválidos.');
  return Number(value);
};
function numeric(value) {
  if (
    value === undefined ||
    String(value).trim() === '' ||
    !Number.isFinite(Number(value)) ||
    Math.abs(Number(value)) > 1e9
  )
    throw bad('El 3MF contiene coordenadas o transformaciones inválidas.');
  return Number(value);
}
function color(value) {
  if (typeof value !== 'string' || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(value))
    throw bad('El 3MF contiene un color no compatible.');
  const values = [1, 3, 5]
    .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return [
    ...values,
    value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1,
  ];
}
const neutral = color('#B9B8B0');
const units = {
  micron: 1e-6,
  millimeter: 0.001,
  centimeter: 0.01,
  inch: 0.0254,
  foot: 0.3048,
  meter: 1,
};
function matrix(value) {
  if (value === undefined) return undefined;
  const a = String(value).trim().split(/\s+/).map(numeric);
  if (a.length !== 12)
    throw bad('El 3MF contiene una transformación inválida.');
  return [
    a[0],
    a[1],
    a[2],
    0,
    a[3],
    a[4],
    a[5],
    0,
    a[6],
    a[7],
    a[8],
    0,
    a[9],
    a[10],
    a[11],
    1,
  ];
}
export async function threeMfToGlb(buffer) {
  const files = await readArchive(buffer);
  let main = '3D/3dmodel.model';
  if (files.has('_rels/.rels')) {
    const relationships =
      xml(files.get('_rels/.rels')).Relationships?.Relationship || [];
    const root = relationships.find((r) => r.Type?.endsWith('/3dmodel'));
    if (root) {
      if (root.TargetMode === 'External')
        throw bad('El 3MF referencia un modelo externo.');
      main = packagePath(root.Target);
    }
  }
  if (!files.has(main)) throw bad('El 3MF no contiene su modelo principal.');
  const docs = new Map();
  let unit;
  function document(name) {
    if (docs.has(name)) return docs.get(name);
    if (!files.has(name)) throw bad('Falta una pieza referenciada por el 3MF.');
    const model = xml(files.get(name)).model;
    if (!model?.resources) throw bad('El 3MF no contiene recursos válidos.');
    const scale = units[model.unit || 'millimeter'];
    if (!scale || (unit && unit !== scale))
      throw bad('El 3MF tiene unidades no compatibles.');
    unit ||= scale;
    const objects = new Map(),
      palettes = new Map();
    for (const object of model.resources.object || []) {
      const id = integer(object.id);
      if (objects.has(id) || objects.size >= 10000)
        throw bad('El 3MF contiene objetos duplicados o demasiados objetos.');
      objects.set(id, object);
    }
    for (const table of [
      ...(model.resources.basematerials || []),
      ...(model.resources.colorgroup || []),
    ]) {
      const entries = table.base || table.color || [];
      if (entries.length > 4096) throw bad('El 3MF tiene demasiados colores.');
      palettes.set(
        integer(table.id),
        entries.map((entry) => color(entry.displaycolor || entry.color)),
      );
    }
    const result = { model, objects, palettes };
    docs.set(name, result);
    return result;
  }
  const projectKey = [...files.keys()].find((k) =>
    /^Metadata\/project_settings\.config$/i.test(k),
  );
  let filamentColors = [];
  if (projectKey) {
    let project;
    try {
      project = JSON.parse(files.get(projectKey).toString('utf8'));
    } catch {
      throw bad('No se pudo leer la configuración de Bambu.');
    }
    const palette = project.filament_colour || project.filament_color || [];
    if (!Array.isArray(palette) || palette.length > 256)
      throw bad('La paleta de filamentos no es válida.');
    filamentColors = palette.map((c) =>
      /^#[\da-f]{6}([\da-f]{2})?$/i.test(c) ? color(c) : null,
    );
  }
  const objectExtruders = new Map(),
    partExtruders = new Map();
  const settingsKey = [...files.keys()].find((k) =>
    /^Metadata\/model_settings\.config$/i.test(k),
  );
  const extruder = (metadata) => {
    const item = (metadata || []).find((m) => m.key === 'extruder');
    return item?.value !== undefined ? integer(item.value) : undefined;
  };
  if (settingsKey) {
    const settings = xml(files.get(settingsKey)).config;
    for (const object of settings?.object || []) {
      const e = extruder(object.metadata);
      if (e !== undefined) objectExtruders.set(String(object.id), e);
      for (const part of object.part || []) {
        const p = extruder(part.metadata);
        if (p !== undefined) partExtruders.set(object.id + ':' + part.id, p);
      }
    }
  }
  const doc = {
    asset: { version: '2.0', generator: 'Impresion3D 3MF color importer' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        name: 'Modelo 3MF',
        rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2],
        children: [],
      },
    ],
    meshes: [],
    materials: [],
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: [],
  };
  const chunks = [],
    materials = new Map(),
    meshes = new Map();
  let byteLength = 0,
    renderedTriangles = 0;
  function material(rgba) {
    const key = rgba.join(',');
    if (materials.has(key)) return materials.get(key);
    const id = doc.materials.length;
    doc.materials.push({
      pbrMetallicRoughness: {
        baseColorFactor: rgba,
        metallicFactor: 0,
        roughnessFactor: 0.75,
      },
      doubleSided: true,
      ...(rgba[3] < 1 ? { alphaMode: 'BLEND' } : {}),
    });
    materials.set(key, id);
    return id;
  }
  function attribute(values, size) {
    const bytes = Buffer.alloc(values.length * 4);
    for (let i = 0; i < values.length; i++)
      bytes.writeFloatLE(values[i], i * 4);
    const view = doc.bufferViews.length;
    doc.bufferViews.push({
      buffer: 0,
      byteOffset: byteLength,
      byteLength: bytes.length,
      target: 34962,
    });
    chunks.push(bytes);
    byteLength += bytes.length;
    const index = doc.accessors.length;
    const item = {
      bufferView: view,
      componentType: 5126,
      count: values.length / size,
      type: size === 3 ? 'VEC3' : 'VEC4',
    };
    if (size === 3) {
      const min = [Infinity, Infinity, Infinity],
        max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < values.length; i++) {
        const a = i % 3;
        min[a] = Math.min(min[a], values[i]);
        max[a] = Math.max(max[a], values[i]);
      }
      item.min = min;
      item.max = max;
    }
    doc.accessors.push(item);
    return index;
  }
  function meshFor(source, object, fallback) {
    const key =
      source + '#' + object.id + ':' + (fallback?.join(',') || 'default');
    if (meshes.has(key)) return meshes.get(key);
    const vertices = object.mesh.vertices?.vertex || [],
      triangles = object.mesh.triangles?.triangle || [];
    if (
      !vertices.length ||
      vertices.length > 1000000 ||
      !triangles.length ||
      triangles.length > 300000
    )
      throw bad('El 3MF tiene geometría vacía o demasiado compleja.');
    const points = vertices.map((v) => [
      numeric(v.x),
      numeric(v.y),
      numeric(v.z),
    ]);
    const groups = new Map(),
      palettes = document(source).palettes;
    const getColor = (pid, index) => {
      const palette = palettes.get(integer(pid));
      const c = palette?.[integer(index)];
      if (!c) throw bad('El 3MF usa materiales o texturas no compatibles.');
      return c;
    };
    for (const triangle of triangles) {
      if (
        triangle.paint_color !== undefined ||
        triangle.mmu_segmentation !== undefined
      )
        throw bad(
          'Este 3MF usa pintado avanzado de Bambu que todavía no se admite. Exportá sus partes con colores separados.',
        );
      const indices = [triangle.v1, triangle.v2, triangle.v3].map((i) =>
        integer(i, points.length - 1),
      );
      const positions = indices.map((i) => points[i]);
      if (positions.some((p) => !p))
        throw bad('El 3MF referencia vértices inexistentes.');
      const pid = triangle.pid ?? object.pid,
        p1 = triangle.p1 ?? object.pindex ?? 0;
      let colors;
      if (pid !== undefined)
        colors = [p1, triangle.p2 ?? p1, triangle.p3 ?? p1].map((i) =>
          getColor(pid, i),
        );
      else
        colors = [
          fallback || neutral,
          fallback || neutral,
          fallback || neutral,
        ];
      const gradient = colors.some((c) => c.some((v, i) => v !== colors[0][i]));
      const key = gradient ? 'vertexColors' : colors[0].join(',');
      if (!groups.has(key))
        groups.set(key, {
          positions: [],
          normals: [],
          colors: [],
          material: material(gradient ? [1, 1, 1, 1] : colors[0]),
          gradient,
        });
      const group = groups.get(key);
      const [a, b, c] = positions,
        ux = b[0] - a[0],
        uy = b[1] - a[1],
        uz = b[2] - a[2],
        vx = c[0] - a[0],
        vy = c[1] - a[1],
        vz = c[2] - a[2];
      let nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      for (let i = 0; i < 3; i++) {
        group.positions.push(...positions[i]);
        group.normals.push(nx, ny, nz);
        if (gradient) group.colors.push(...colors[i]);
      }
    }
    const primitives = [];
    for (const group of groups.values()) {
      const attributes = {
        POSITION: attribute(group.positions, 3),
        NORMAL: attribute(group.normals, 3),
      };
      if (group.gradient) attributes.COLOR_0 = attribute(group.colors, 4);
      primitives.push({ attributes, material: group.material, mode: 4 });
    }
    const result = { index: doc.meshes.length, triangles: triangles.length };
    doc.meshes.push({ name: object.name || 'Pieza', primitives });
    meshes.set(key, result);
    return result;
  }
  function instantiate(source, id, stack = [], context = id, inherited) {
    const resource = source + '#' + id;
    if (
      stack.includes(resource) ||
      stack.length >= 32 ||
      doc.nodes.length >= 10000
    )
      throw bad('El 3MF tiene referencias circulares o demasiadas piezas.');
    const object = document(source).objects.get(integer(id));
    if (!object) throw bad('El 3MF referencia una pieza inexistente.');
    const e =
      partExtruders.get(context + ':' + id) ??
      objectExtruders.get(String(id)) ??
      inherited;
    let fallback;
    if (e !== undefined) {
      fallback = filamentColors[e - 1];
      if (!fallback)
        throw bad('El 3MF no incluye el color de un filamento asignado.');
    }
    const node = { name: object.name || 'Pieza ' + id },
      index = doc.nodes.length;
    doc.nodes.push(node);
    if (object.mesh) {
      const mesh = meshFor(source, object, fallback);
      renderedTriangles += mesh.triangles;
      if (renderedTriangles > 300000)
        throw bad('El conjunto del 3MF supera los 300.000 triángulos.');
      node.mesh = mesh.index;
    }
    if (object.components) {
      node.children = [];
      for (const component of object.components.component || []) {
        const target = component.path
          ? packagePath(component.path, source)
          : source;
        const child = instantiate(
          target,
          component.objectid,
          [...stack, resource],
          context,
          e,
        );
        const transform = matrix(component.transform);
        if (transform) doc.nodes[child].matrix = transform;
        node.children.push(child);
      }
    }
    if (node.mesh === undefined && !node.children?.length)
      throw bad('El 3MF contiene una pieza sin geometría.');
    return index;
  }
  const mainDoc = document(main);
  for (const item of mainDoc.model.build?.item || []) {
    if (item.printable === '0') continue;
    const node = instantiate(main, item.objectid);
    const transform = matrix(item.transform);
    if (transform) doc.nodes[node].matrix = transform;
    doc.nodes[0].children.push(node);
  }
  if (!doc.nodes[0].children.length || !doc.meshes.length)
    throw bad('El 3MF no tiene piezas para mostrar.');
  doc.nodes[0].scale = [unit, unit, unit];
  doc.buffers[0].byteLength = byteLength;
  const json = Buffer.from(JSON.stringify(doc)),
    padding = Buffer.alloc((4 - (json.length % 4)) % 4, 32),
    binary = Buffer.concat(chunks);
  const length = 12 + 8 + json.length + padding.length + 8 + binary.length;
  if (length > 10 * 1024 * 1024)
    throw bad(
      'El 3MF convertido supera los 10 MiB. Exportá una versión más liviana.',
    );
  const header = Buffer.alloc(20);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(length, 8);
  header.writeUInt32LE(json.length + padding.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return {
    buffer: Buffer.concat([header, json, padding, binHeader, binary]),
    format: 'glb',
    sourceFormat: '3mf',
    objectCount: doc.nodes[0].children.length,
    colorCount: doc.materials.length,
    triangles: renderedTriangles,
  };
}
