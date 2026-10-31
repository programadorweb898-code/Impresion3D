function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zipArchive(files) {
  let offset = 0;
  const local = [],
    central = [];
  for (const [name, value] of Object.entries(files)) {
    const filename = Buffer.from(name),
      data = Buffer.from(value),
      crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(filename.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, filename);
    offset += header.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
const mesh =
  '<mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/><vertex x="0" y="0" z="1"/></vertices><triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/><triangle v1="1" v2="2" v3="3"/></triangles></mesh>';
export function coloredThreeMf({
  bambu = false,
  transformXml = (xml) => xml,
  extra = {},
} = {}) {
  const resources = bambu
    ? ''
    : '<basematerials id="9"><base name="Negro" displaycolor="#161616FF"/><base name="Blanco" displaycolor="#FFFFFFFF"/></basematerials>';
  const one = bambu ? '' : ' pid="9" pindex="0"',
    two = bambu ? '' : ' pid="9" pindex="1"';
  let xml = `<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="millimeter"><resources>${resources}<object id="1" name="Parte negra"${one}>${mesh}</object><object id="2" name="Parte blanca"${two}>${mesh}</object><object id="10" name="Llavero"><components><component objectid="1"/><component objectid="2" transform="1 0 0 0 1 0 0 0 1 5 0 0"/></components></object></resources><build><item objectid="10" transform="1 0 0 0 1 0 0 0 1 20 30 0"/></build></model>`;
  const metadata = bambu
    ? {
        'Metadata/project_settings.config': JSON.stringify({
          filament_colour: ['#161616', '#FFFFFF'],
        }),
        'Metadata/model_settings.config':
          '<config><object id="10"><metadata key="extruder" value="1"/><part id="2"><metadata key="extruder" value="2"/></part></object></config>',
      }
    : {};
  return zipArchive({
    '3D/3dmodel.model': transformXml(xml),
    ...metadata,
    ...extra,
  });
}
export function glbJson(buffer) {
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString('utf8', 20, 20 + length).trim());
}
