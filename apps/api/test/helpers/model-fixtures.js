export function tetraStl() {
  const vertices = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const triangles = [
    [0, 2, 1],
    [0, 1, 3],
    [0, 3, 2],
    [1, 2, 3],
  ];
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.write('Test tetrahedron');
  buffer.writeUInt32LE(triangles.length, 80);
  triangles.forEach((triangle, t) =>
    triangle.forEach((vertex, v) =>
      vertices[vertex].forEach((n, axis) =>
        buffer.writeFloatLE(n, 84 + t * 50 + 12 + v * 12 + axis * 4),
      ),
    ),
  );
  return buffer;
}
export function tetraGlb(transform = (doc) => doc) {
  const bin = Buffer.alloc(72);
  [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((n, i) =>
    bin.writeFloatLE(n, i * 4),
  );
  [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3].forEach((n, i) =>
    bin.writeUInt16LE(n, 48 + i * 2),
  );
  const doc = transform({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] },
    ],
    buffers: [{ byteLength: 72 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 48, target: 34962 },
      { buffer: 0, byteOffset: 48, byteLength: 24, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 1],
      },
      { bufferView: 1, componentType: 5123, count: 12, type: 'SCALAR' },
    ],
  });
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
  json.copy(padded);
  const buffer = Buffer.alloc(12 + 8 + padded.length + 8 + bin.length);
  buffer.write('glTF');
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(buffer, 20);
  const offset = 20 + padded.length;
  buffer.writeUInt32LE(bin.length, offset);
  buffer.writeUInt32LE(0x004e4942, offset + 4);
  bin.copy(buffer, offset + 8);
  return buffer;
}
