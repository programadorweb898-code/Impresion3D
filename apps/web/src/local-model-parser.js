import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'three/addons/libs/fflate.module.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { SaxesParser } from 'saxes';

const invalid = (message = 'El archivo no contiene un modelo 3D válido.') =>
  Object.assign(new Error(message), { isModelError: true });
const children = (node, name) =>
  Array.from(node?.childNodes || []).filter(
    (n) => n.nodeType === 1 && (name === undefined || n.localName === name),
  );
const child = (node, name) => children(node, name)[0];
// Keep only the small resource tree; mesh rows go directly into numeric buffers.
// A full XML DOM for a detailed mesh can otherwise consume gigabytes of memory.
function xmlNode(localName, attributes = {}) {
  return {
    nodeType: 1,
    localName,
    childNodes: [],
    attributes: Object.entries(attributes).map(([name, value]) => ({
      localName: name.split(':').pop(),
      value,
    })),
    getAttribute: (name) => attributes[name] ?? null,
    hasAttribute: (name) => Object.hasOwn(attributes, name),
  };
}
function appendNumbers(node, values) {
  const length = node.length || 0;
  if (!node.values || length + values.length > node.values.length) {
    const next = new Float64Array(
      Math.max(3072, (node.values?.length || 0) * 2),
    );
    if (node.values) next.set(node.values);
    node.values = next;
  }
  node.values.set(values, length);
  node.length = length + values.length;
  node.count = node.length / 3;
}
function xml(bytes) {
  const text = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw invalid();
  const parser = new SaxesParser({ xmlns: true });
  const stack = [];
  let root;
  parser.on('error', () => {
    throw invalid();
  });
  parser.on('opentag', (tag) => {
    if (stack.length > 128) throw invalid();
    const parent = stack.at(-1);
    const attributes = Object.fromEntries(
      Object.entries(tag.attributes).map(([name, attribute]) => [
        name,
        attribute.value,
      ]),
    );
    if (tag.local === 'vertex' && parent?.localName === 'vertices') {
      const vertex = ['x', 'y', 'z'].map((key) =>
        attributes[key] === undefined ? NaN : Number(attributes[key]),
      );
      if (vertex.some((n) => !Number.isFinite(n))) throw invalid();
      if ((parent.count || 0) >= 4500000) throw invalid();
      appendNumbers(parent, vertex);
      stack.push(null);
      return;
    }
    if (tag.local === 'triangle' && parent?.localName === 'triangles') {
      const indices = ['v1', 'v2', 'v3'].map((key) =>
        attributes[key] === undefined ? NaN : Number(attributes[key]),
      );
      if (indices.some((n) => !Number.isSafeInteger(n) || n < 0))
        throw invalid();
      if ((parent.count || 0) >= 1500000)
        throw invalid(
          'El modelo supera el límite de 1,5 millones de triángulos. Exportá una versión más liviana.',
        );
      const index = parent.count || 0;
      appendNumbers(parent, indices);
      delete attributes.v1;
      delete attributes.v2;
      delete attributes.v3;
      if (Object.keys(attributes).length) {
        parent.properties ||= new Map();
        parent.properties.set(index, attributes);
      }
      stack.push(null);
      return;
    }
    if (stack.length && !parent) throw invalid();
    const node = xmlNode(tag.local, attributes);
    if (parent) parent.childNodes.push(node);
    else root = node;
    stack.push(node);
  });
  parser.on('closetag', () => stack.pop());
  parser.write(text).close();
  if (!root) throw invalid();
  return root;
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
      const faces = child(mesh, 'triangles');
      triangles += faces?.count || 0;
      if (triangles > 1500000)
        throw invalid(
          'El modelo supera el límite de 1,5 millones de triángulos. Exportá una versión más liviana.',
        );
      const cacheKey = key + ':' + slot;
      if (cache.has(cacheKey)) return cache.get(cacheKey).clone();
      const vertices = child(mesh, 'vertices');
      if (!faces?.count || !vertices?.count) throw invalid();
      const positions = new Float32Array(faces.count * 9);
      const colors = new Float32Array(faces.count * 9);
      const propertyTables = new Map(
        children(resources).map((p) => [p.getAttribute('id'), p]),
      );
      let missing = false,
        unknown = false;
      for (let index = 0; index < faces.count; index++) {
        const face = xmlNode('triangle', faces.properties?.get(index));
        const paint = { 8: 2, '0C': 3, '1C': 4 }[
          face.getAttribute('paint_color')
        ];
        let color = palette[(paint || slot) - 1];
        const pid = face.getAttribute('pid') || data.getAttribute('pid');
        if (pid) {
          const props = propertyTables.get(pid);
          const item =
            children(props)[
              Number(
                face.getAttribute('p1') || data.getAttribute('pindex') || 0,
              )
            ];
          color =
            item?.getAttribute('displaycolor') || item?.getAttribute('color');
        }
        const hasPaint =
          face.hasAttribute('paint_color') ||
          face.hasAttribute('mmu_segmentation');
        if (hasPaint && !paint) unknown = true;
        else if (pid) {
          const props = propertyTables.get(pid);
          const p1 =
            face.getAttribute('p1') ?? data.getAttribute('pindex') ?? '0';
          for (const property of [
            p1,
            face.getAttribute('p2') ?? p1,
            face.getAttribute('p3') ?? p1,
          ]) {
            const item = children(props)[Number(property)];
            if (
              !/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(
                item?.getAttribute('displaycolor') ||
                  item?.getAttribute('color') ||
                  '',
              )
            )
              unknown = true;
          }
        } else if (!/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color || '')) {
          if (hasPaint || palette.length) unknown = true;
          else missing = true;
        }
        const colorKey = /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color || '')
          ? color.slice(0, 7)
          : '#c4c4bc';
        if (!colorCache.has(colorKey))
          colorCache.set(colorKey, new THREE.Color(colorKey));
        ['v1', 'v2', 'v3'].forEach((key, corner) => {
          const p1 =
            face.getAttribute('p1') ?? data.getAttribute('pindex') ?? '0';
          const item = children(propertyTables.get(pid))[
            Number(face.getAttribute('p' + (corner + 1)) ?? p1)
          ];
          const cornerColor =
            item?.getAttribute('displaycolor') || item?.getAttribute('color');
          const vertexColorKey = /^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(
            cornerColor || '',
          )
            ? cornerColor.slice(0, 7)
            : colorKey;
          if (!colorCache.has(vertexColorKey))
            colorCache.set(vertexColorKey, new THREE.Color(vertexColorKey));
          const c = colorCache.get(vertexColorKey);
          const vertex = faces.values[index * 3 + corner];
          if (vertex >= vertices.count) throw invalid();
          const offset = vertex * 3;
          positions.set(
            vertices.values.subarray(offset, offset + 3),
            index * 9 + corner * 3,
          );
          colors.set([c.r, c.g, c.b], index * 9 + corner * 3);
        });
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const m = material('#ffffff');
      m.vertexColors = true;
      const piece = new THREE.Mesh(geometry, m);
      piece.userData.colorStatus = missing
        ? 'missing'
        : unknown
          ? 'unknown'
          : 'complete';
      const label = children(part, 'metadata')
        .find((entry) => entry.getAttribute('key') === 'name')
        ?.getAttribute('value');
      piece.name =
        label ||
        data.getAttribute('name') ||
        children(setting, 'metadata')
          .find((entry) => entry.getAttribute('key') === 'name')
          ?.getAttribute('value') ||
        '';
      group.add(piece);
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
  const colorStates = [];
  group.traverse((part) => {
    if (part.isMesh) colorStates.push(part.userData.colorStatus);
  });
  group.userData.colorStatus = colorStates.includes('missing')
    ? 'missing'
    : colorStates.includes('unknown')
      ? 'unknown'
      : 'complete';
  group.scale.setScalar(unit);
  group.rotation.x = -Math.PI / 2;
  return group;
}
// STL has no object list: weld identical positions to identify disconnected shells.
function stlComponents(geometry) {
  const positions = geometry.getAttribute('position');
  const count = Math.floor(positions.count / 3);
  const parents = new Uint32Array(count);
  const vertices = new Map();
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
      }
    }
  }
  const bounds = new Map();
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const id = find(Math.floor(i / 3));
    if (!bounds.has(id)) bounds.set(id, new THREE.Box3());
    bounds
      .get(id)
      .expandByPoint(
        point.set(positions.getX(i), positions.getY(i), positions.getZ(i)),
      );
  }
  return Array.from(bounds.values(), (box, i) => ({
    name: 'Pieza ' + (i + 1),
    min: box.min.toArray(),
    max: box.max.toArray(),
  }));
}

export function parseLocalMesh(buffer, format) {
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
    const m = material(geometry.hasColors ? '#ffffff' : undefined);
    m.vertexColors = !!geometry.hasColors;
    root.add(new THREE.Mesh(geometry, m));
    root.userData.colorStatus = geometry.hasColors ? 'complete' : 'missing';
    root.userData.partBounds = stlComponents(geometry);
    root.rotation.x = -Math.PI / 2;
    return root;
  }
  throw invalid();
}
