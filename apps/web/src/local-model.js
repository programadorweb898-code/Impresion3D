import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'three/addons/libs/fflate.module.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const invalid = (message = 'El archivo no contiene un modelo 3D válido.') =>
  new Error(message);
const children = (node, name) =>
  Array.from(node?.children || []).filter((n) => n.localName === name);
const child = (node, name) => children(node, name)[0];
function xml(bytes) {
  const text = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw invalid();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw invalid();
  return doc.documentElement;
}
function path(value, parent = '') {
  if (!value || /[\\?#]|^[a-z][a-z0-9+.-]*:/i.test(value))
    throw invalid(
      'El modelo debe incluir todos sus recursos dentro del archivo.',
    );
  const parts = (
    value.startsWith('/')
      ? value.slice(1)
      : parent.slice(0, parent.lastIndexOf('/') + 1) + value
  ).split('/');
  const result = [];
  for (const part of parts) {
    if (part === '..') {
      if (!result.length) throw invalid();
      result.pop();
    } else if (part && part !== '.') result.push(part);
  }
  return result.join('/');
}
function transform(node) {
  const text = node.getAttribute('transform');
  if (!text) return new THREE.Matrix4();
  const v = text.trim().split(/\s+/).map(Number);
  if (v.length !== 12 || v.some((n) => !Number.isFinite(n))) throw invalid();
  return new THREE.Matrix4().set(
    v[0],
    v[3],
    v[6],
    v[9],
    v[1],
    v[4],
    v[7],
    v[10],
    v[2],
    v[5],
    v[8],
    v[11],
    0,
    0,
    0,
    1,
  );
}
function material(color = '#c4c4bc') {
  return new THREE.MeshStandardMaterial({
    color: /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color)
      ? color.slice(0, 7)
      : '#c4c4bc',
    roughness: 0.8,
    metalness: 0,
  });
}
function threeMf(buffer) {
  let total = 0,
    count = 0;
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (entry) => {
      if (++count > 2048) throw invalid('El 3MF contiene demasiados archivos.');
      if (
        !/\.model$|\.rels$|Metadata\/(?:project_settings|model_settings)\.config$/i.test(
          entry.name,
        )
      )
        return false;
      total += entry.originalSize;
      if (total > 128 * 1024 * 1024)
        throw invalid(
          'El 3MF es demasiado complejo para esta vista. Exportá una versión más liviana.',
        );
      return true;
    },
  });
  const documents = new Map();
  const getDocument = (name) => {
    if (!documents.has(name)) {
      if (!files[name]) throw invalid('Faltan piezas dentro del 3MF.');
      documents.set(name, xml(files[name]));
    }
    return documents.get(name);
  };
  const relations = files['_rels/.rels'] && xml(files['_rels/.rels']);
  const relation = children(relations, 'Relationship').find((r) =>
    /3dmodel$/i.test(r.getAttribute('Type') || ''),
  );
  if (relation?.getAttribute('TargetMode') === 'External') throw invalid();
  const main = relation
    ? path(relation.getAttribute('Target'))
    : '3D/3dmodel.model';
  const root = getDocument(main);
  const units = {
    micron: 0.001,
    millimeter: 1,
    centimeter: 10,
    inch: 25.4,
    foot: 304.8,
    meter: 1000,
  };
  const unit = units[root.getAttribute('unit') || 'millimeter'];
  if (!unit) throw invalid('No se reconoce la unidad de medida del 3MF.');
  let palette = [];
  if (files['Metadata/project_settings.config']) {
    palette =
      JSON.parse(strFromU8(files['Metadata/project_settings.config']))
        .filament_colour || [];
  }
  const settings =
    files['Metadata/model_settings.config'] &&
    xml(files['Metadata/model_settings.config']);
  const extruder = (node, fallback) =>
    Number(
      children(node, 'metadata')
        .find((m) => m.getAttribute('key') === 'extruder')
        ?.getAttribute('value'),
    ) || fallback;
  const objectSettings = new Map(
    children(settings, 'object').map((o) => [o.getAttribute('id'), o]),
  );
  let triangles = 0,
    instances = 0;
  const cache = new Map();
  const colorCache = new Map();
  function object(file, id, owner, stack = []) {
    if (++instances > 5000 || stack.length > 64)
      throw invalid('El 3MF contiene demasiadas piezas.');
    const key = file + ':' + id;
    if (stack.includes(key))
      throw invalid('El 3MF contiene referencias circulares.');
    const model = getDocument(file),
      resources = child(model, 'resources');
    const data = children(resources, 'object').find(
      (o) => o.getAttribute('id') === id,
    );
    if (!data) throw invalid();
    const setting = objectSettings.get(owner);
    const part = children(setting, 'part').find(
      (p) => p.getAttribute('id') === id,
    );
    if (
      part &&
      part.getAttribute('subtype') &&
      part.getAttribute('subtype') !== 'normal_part'
    )
      return new THREE.Group();
    const slot = extruder(part, extruder(setting, 1));
    const mesh = child(data, 'mesh');
    const group = new THREE.Group();
    if (mesh) {
      const faces = children(child(mesh, 'triangles'), 'triangle');
      triangles += faces.length;
      if (triangles > 1500000)
        throw invalid(
          'El modelo supera el límite de 1,5 millones de triángulos. Exportá una versión más liviana.',
        );
      const cacheKey = key + ':' + slot;
      if (cache.has(cacheKey)) return cache.get(cacheKey).clone();
      const vertices = children(child(mesh, 'vertices'), 'vertex').map((v) =>
        ['x', 'y', 'z'].map((k) => Number(v.getAttribute(k))),
      );
      if (vertices.some((v) => v.some((n) => !Number.isFinite(n))))
        throw invalid();
      const positions = new Float32Array(faces.length * 9);
      const colors = new Float32Array(faces.length * 9);
      faces.forEach((face, index) => {
        const paint = { 8: 2, '0C': 3, '1C': 4 }[
          face.getAttribute('paint_color')
        ];
        let color = palette[(paint || slot) - 1];
        const pid = face.getAttribute('pid') || data.getAttribute('pid');
        if (!color && pid) {
          const props = Array.from(resources.children).find(
            (p) => p.getAttribute('id') === pid,
          );
          const item =
            props?.children[
              Number(
                face.getAttribute('p1') || data.getAttribute('pindex') || 0,
              )
            ];
          color =
            item?.getAttribute('displaycolor') || item?.getAttribute('color');
        }
        const colorKey = /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color || '')
          ? color.slice(0, 7)
          : '#c4c4bc';
        if (!colorCache.has(colorKey))
          colorCache.set(colorKey, new THREE.Color(colorKey));
        const c = colorCache.get(colorKey);
        ['v1', 'v2', 'v3'].forEach((key, corner) => {
          const v = vertices[Number(face.getAttribute(key))];
          if (!v) throw invalid();
          positions.set(v, index * 9 + corner * 3);
          colors.set([c.r, c.g, c.b], index * 9 + corner * 3);
        });
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const m = material('#ffffff');
      m.vertexColors = true;
      group.add(new THREE.Mesh(geometry, m));
      cache.set(cacheKey, group.clone());
    } else {
      for (const c of children(child(data, 'components'), 'component')) {
        const external = Array.from(c.attributes).find(
          (a) => a.localName === 'path',
        )?.value;
        const part = object(
          external ? path(external, file) : file,
          c.getAttribute('objectid'),
          owner,
          [...stack, key],
        );
        part.applyMatrix4(transform(c));
        group.add(part);
      }
    }
    return group;
  }
  const group = new THREE.Group();
  for (const item of children(child(root, 'build'), 'item')) {
    if (item.getAttribute('printable') === '0') continue;
    const id = item.getAttribute('objectid');
    const part = object(main, id, id);
    part.applyMatrix4(transform(item));
    group.add(part);
  }
  group.scale.setScalar(unit);
  group.rotation.x = -Math.PI / 2;
  return group;
}
// STL has no object list: weld identical positions to identify disconnected shells.
function stlComponentCount(geometry) {
  const positions = geometry.getAttribute('position');
  const count = Math.floor(positions.count / 3);
  const parents = new Uint32Array(count);
  const vertices = new Map();
  let components = count;
  for (let i = 0; i < count; i++) parents[i] = i;
  function find(i) {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  }
  for (let i = 0; i < positions.count; i++) {
    const triangle = Math.floor(i / 3);
    const key =
      positions.getX(i) + ',' + positions.getY(i) + ',' + positions.getZ(i);
    if (!vertices.has(key)) vertices.set(key, triangle);
    else {
      const a = find(triangle),
        b = find(vertices.get(key));
      if (a !== b) {
        parents[a] = b;
        components--;
      }
    }
  }
  return components;
}

export async function parseLocalModel(buffer, format) {
  if (format === '3mf') return threeMf(buffer);
  if (format === 'stl') {
    const geometry = new STLLoader().parse(buffer);
    if (
      !geometry.getAttribute('position') ||
      geometry.getAttribute('position').count > 4500000
    )
      throw invalid();
    geometry.computeVertexNormals();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, material()));
    root.userData.componentCount = stlComponentCount(geometry);
    root.rotation.x = -Math.PI / 2;
    return root;
  }
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
  root.scale.multiplyScalar(1000); // glTF uses meters; all local measurements use millimeters.
  return root;
}
