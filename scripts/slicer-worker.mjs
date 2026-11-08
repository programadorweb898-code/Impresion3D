#!/usr/bin/env node
// Standalone, dependency-free bridge. It only slices: no printer or print API exists here.
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
  open,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { createInterface } from 'node:readline/promises';
const SITE = 'https://impresion-3d.onrender.com';
const stateDir = path.join(
  process.env.LOCALAPPDATA || path.join(homedir(), '.local', 'share'),
  'Mundo3D',
);
const configPath = path.join(stateDir, 'slicer-worker.json');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (code, message) =>
  Object.assign(new Error(message || code), { code });
export function siteOrigin(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== '/' ||
    !(
      u.protocol === 'https:' ||
      (u.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(u.hostname))
    )
  )
    throw Error('Usá la dirección HTTPS de tu sitio.');
  return u.origin;
}
export async function zipEntries(filename) {
  const file = await open(filename, 'r');
  try {
    const { size } = await file.stat();
    if (size < 22) throw fail('RESULT_INVALID');
    const tail = Buffer.alloc(Math.min(size, 65557));
    await file.read(tail, 0, tail.length, size - tail.length);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--)
      if (
        tail.readUInt32LE(i) === 0x06054b50 &&
        i + 22 + tail.readUInt16LE(i + 20) === tail.length
      ) {
        end = i;
        break;
      }
    if (
      end < 0 ||
      tail.readUInt16LE(end + 4) !== 0 ||
      tail.readUInt16LE(end + 6) !== 0
    )
      throw fail('RESULT_INVALID');
    const count = tail.readUInt16LE(end + 10),
      length = tail.readUInt32LE(end + 12),
      offset = tail.readUInt32LE(end + 16);
    if (
      count > 20000 ||
      length > 8 * 1024 * 1024 ||
      offset + length > size - tail.length + end
    )
      throw fail('RESULT_INVALID');
    const directory = Buffer.alloc(length);
    await file.read(directory, 0, length, offset);
    const entries = new Map();
    let cursor = 0;
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > length || directory.readUInt32LE(cursor) !== 0x02014b50)
        throw fail('RESULT_INVALID');
      const n = directory.readUInt16LE(cursor + 28),
        extra = directory.readUInt16LE(cursor + 30),
        comment = directory.readUInt16LE(cursor + 32),
        next = cursor + 46 + n + extra + comment;
      if (next > length) throw fail('RESULT_INVALID');
      const name = directory.toString('utf8', cursor + 46, cursor + 46 + n);
      if (entries.has(name)) throw fail('RESULT_INVALID');
      entries.set(name, {
        method: directory.readUInt16LE(cursor + 10),
        flags: directory.readUInt16LE(cursor + 8),
        compressed: directory.readUInt32LE(cursor + 20),
        size: directory.readUInt32LE(cursor + 24),
        offset: directory.readUInt32LE(cursor + 42),
      });
      cursor = next;
    }
    return entries;
  } finally {
    await file.close();
  }
}
export async function zipText(filename, name, entries) {
  const entry = (entries || (await zipEntries(filename))).get(name);
  if (!entry) return null;
  if (
    entry.flags & 1 ||
    ![0, 8].includes(entry.method) ||
    entry.compressed > 2 * 1024 * 1024 ||
    entry.size > 2 * 1024 * 1024
  )
    throw fail('RESULT_INVALID');
  const file = await open(filename, 'r');
  try {
    const header = Buffer.alloc(30);
    await file.read(header, 0, 30, entry.offset);
    if (header.readUInt32LE(0) !== 0x04034b50) throw fail('RESULT_INVALID');
    const start =
      entry.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const buffer = Buffer.alloc(entry.compressed);
    const read = await file.read(buffer, 0, buffer.length, start);
    if (read.bytesRead !== buffer.length) throw fail('RESULT_INVALID');
    const data =
      entry.method === 8
        ? inflateRawSync(buffer, { maxOutputLength: 2 * 1024 * 1024 })
        : buffer;
    if (data.length !== entry.size) throw fail('RESULT_INVALID');
    return data.toString('utf8');
  } finally {
    await file.close();
  }
}
const attributes = (text) =>
  Object.fromEntries(
    Array.from(text.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g), (m) => [
      m[1],
      m[3],
    ]),
  );
export function parseSliceStats(text) {
  if (!text || /<!DOCTYPE|<!ENTITY/i.test(text)) throw fail('RESULT_INVALID');
  const plates = Array.from(
    text.matchAll(/<plate\b[^>]*>([\s\S]*?)<\/plate>/g),
  );
  if (!plates.length) throw fail('RESULT_INVALID');
  let grams = 0,
    seconds = 0;
  for (const [, content] of plates) {
    const metadata = Object.fromEntries(
      Array.from(content.matchAll(/<metadata\b[^>]*\/?\s*>/g), (m) => {
        const a = attributes(m[0]);
        return [a.key, a.value];
      }),
    );
    const filaments = Array.from(
      content.matchAll(/<filament\b[^>]*\/?\s*>/g),
      (m) => attributes(m[0]),
    );
    const weight = filaments.length
        ? filaments.reduce((sum, f) => sum + Number(f.used_g), 0)
        : Number(metadata.weight),
      time = Number(metadata.prediction);
    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isFinite(time) ||
      time <= 0
    )
      throw fail('RESULT_INVALID');
    grams += weight;
    seconds += time;
  }
  if (grams > 100000 || seconds > 36000000) throw fail('RESULT_INVALID');
  return { grams, seconds, plates: plates.length };
}
export async function loadProfiles(config, base = process.cwd()) {
  if (
    !Array.isArray(config.profiles) ||
    !config.profiles.length ||
    config.profiles.length > 10
  )
    throw fail(
      'PROFILE_INVALID',
      'Configurá entre uno y diez perfiles locales.',
    );
  const seen = new Set();
  const result = [];
  for (const p of config.profiles) {
    if (
      !/^[a-z0-9-]{1,40}$/.test(p.id) ||
      seen.has(p.id) ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name.length > 80 ||
      !['PLA', 'PETG', 'TPU'].includes(p.material) ||
      !Array.isArray(p.filaments) ||
      p.filaments.length < 1 ||
      p.filaments.length > 4
    )
      throw fail(
        'PROFILE_INVALID',
        'Revisá el nombre, material y archivos de cada perfil.',
      );
    seen.add(p.id);
    const read = async (f) => {
      if (typeof f !== 'string' || f.includes(';'))
        throw fail('PROFILE_INVALID');
      const bytes = await readFile(path.resolve(base, f));
      if (bytes.length > 2 * 1024 * 1024) throw fail('PROFILE_INVALID');
      return JSON.parse(bytes);
    };
    const machine = await read(p.machine),
      process = await read(p.process),
      filaments = await Promise.all(p.filaments.map(read));
    if (
      [machine, process, ...filaments].some(
        (p) =>
          typeof p.name !== 'string' ||
          !p.name.trim() ||
          !['system', 'User', 'user'].includes(p.from),
      )
    )
      throw fail(
        'PROFILE_INVALID',
        'Los perfiles completos deben incluir nombre y origen (from).',
      );
    if (
      machine.type !== 'machine' ||
      !/^Bambu Lab A1(?:\s|$)/i.test(machine.printer_model || '') ||
      /mini/i.test(machine.printer_model) ||
      !Array.isArray(machine.nozzle_diameter) ||
      !machine.nozzle_diameter.length ||
      !machine.printable_area ||
      process.type !== 'process' ||
      !(Number(process.layer_height) > 0) ||
      process.wall_loops === undefined ||
      process.sparse_infill_density === undefined
    )
      throw fail(
        'PROFILE_INVALID',
        'Se necesitan perfiles completos de máquina Bambu A1 y proceso, no solo presets heredados.',
      );
    for (const f of filaments)
      if (
        f.type !== 'filament' ||
        !Array.isArray(f.filament_type) ||
        f.filament_type.some((t) => t !== p.material) ||
        !f.nozzle_temperature ||
        !f.filament_density ||
        !f.filament_diameter
      )
        throw fail(
          'PROFILE_INVALID',
          'Revisá los perfiles completos de filamento y su material.',
        );
    result.push({ ...p, machine, process, filaments });
  }
  return result;
}
export function buildSliceArgs(
  job,
  input,
  output,
  machine,
  process,
  filaments,
) {
  if (
    !['3mf', 'stl'].includes(job.format) ||
    !Number.isFinite(job.scale) ||
    job.scale < 0.001 ||
    job.scale > 1000
  )
    throw fail('UNSUPPORTED');
  return [
    '--load-settings',
    machine + ';' + process,
    '--load-filaments',
    filaments.join(';'),
    '--scale',
    String(job.scale),
    '--arrange',
    '1',
    '--slice',
    '0',
    '--debug',
    '1',
    '--export-3mf',
    output,
    input,
  ];
}
export function runSlicer(
  executable,
  args,
  { timeoutMs = 1800000, signal } = {},
) {
  return new Promise((resolve, reject) => {
    let text = '';
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    });
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (chunk) => {
        text = (text + chunk.toString()).slice(-32768);
      });
    child.on('error', (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(deadline);
      if (timedOut) return reject(fail('TIMEOUT'));
      if (code !== 0) {
        console.error(text.slice(-8000));
        return reject(fail('SLICER_FAILED'));
      }
      resolve(text);
    });
  });
}
async function request(config, route, body, lease) {
  const response = await fetch(config.site + '/api/slicer-worker' + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: 'Bearer ' + config.secret,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(lease ? { 'x-slicing-lease': lease } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const error = Error('El sitio respondió HTTP ' + response.status);
    error.status = response.status;
    throw error;
  }
  return response;
}
async function filamentCount(file, job) {
  if (job.format === 'stl') {
    if (job.colorStatus === 'complete') throw fail('UNSUPPORTED');
    return 1;
  }
  const entries = await zipEntries(file);
  const project = await zipText(
    file,
    'Metadata/project_settings.config',
    entries,
  );
  if (project) {
    const settings = JSON.parse(project),
      palette = settings.filament_colour || settings.filament_color;
    if (Array.isArray(palette) && palette.length > 0 && palette.length <= 4)
      return palette.length;
    throw fail('UNSUPPORTED');
  }
  // Colored generic 3MF needs explicit manual mapping into Bambu filament slots.
  if (job.colorStatus !== 'missing') throw fail('UNSUPPORTED');
  return 1;
}
async function processJob(config, profiles, job) {
  if (
    !/^[a-f0-9]{24}$/.test(job.jobId) ||
    !/^[a-f0-9]{64}$/.test(job.lease) ||
    !['3mf', 'stl'].includes(job.format) ||
    !Number.isFinite(job.scale) ||
    job.scale < 0.001 ||
    job.scale > 1000 ||
    !Number.isInteger(job.quantity) ||
    job.quantity < 1 ||
    job.quantity > 1000
  )
    throw Error('Respuesta del sitio inválida.');
  const controller = new AbortController();
  const folder = await mkdtemp(path.join(tmpdir(), 'mundo3d-slice-'));
  let renewing = false,
    lost = false;
  const heartbeat = setInterval(async () => {
    if (renewing) return;
    renewing = true;
    try {
      await request(config, '/jobs/' + job.jobId + '/heartbeat', {}, job.lease);
    } catch (e) {
      if (e.status === 401 || e.status === 409) {
        lost = true;
        controller.abort();
      }
    } finally {
      renewing = false;
    }
  }, 45000);
  try {
    const profile = profiles.find((p) => p.id === job.profileId);
    if (!profile) throw fail('PROFILE_INVALID');
    const input = path.join(folder, 'modelo.' + job.format),
      output = path.join(folder, 'laminado.3mf');
    const response = await request(
      config,
      '/jobs/' + job.jobId + '/file',
      undefined,
      job.lease,
    );
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length || data.length > 50 * 1024 * 1024)
      throw fail('UNSUPPORTED');
    await writeFile(input, data, { mode: 0o600 });
    const slots = await filamentCount(input, job);
    if (slots > profile.filaments.length) throw fail('UNSUPPORTED');
    const machine = path.join(folder, 'machine.json'),
      process = path.join(folder, 'process.json'),
      filamentPaths = [];
    await writeFile(machine, JSON.stringify(profile.machine), { mode: 0o600 });
    await writeFile(process, JSON.stringify(profile.process), { mode: 0o600 });
    for (let i = 0; i < slots; i++) {
      const f = path.join(folder, 'filament-' + i + '.json');
      const json = { ...profile.filaments[i] };
      delete json.filament_colour;
      delete json.filament_color;
      await writeFile(f, JSON.stringify(json), { mode: 0o600 });
      filamentPaths.push(f);
    }
    await runSlicer(
      config.executable,
      buildSliceArgs(job, input, output, machine, process, filamentPaths),
      { signal: controller.signal },
    );
    const stats = parseSliceStats(
      await zipText(output, 'Metadata/slice_info.config'),
    );
    if (!lost)
      await request(
        config,
        '/jobs/' + job.jobId + '/result',
        { ok: true, ...stats },
        job.lease,
      );
    console.log('Laminado procesado. Revisá la estimación en administración.');
  } catch (error) {
    if (!lost) {
      const code = [
        'SLICER_FAILED',
        'TIMEOUT',
        'PROFILE_INVALID',
        'UNSUPPORTED',
        'RESULT_INVALID',
      ].includes(error.code)
        ? error.code
        : 'CONNECTION_LOST';
      await request(
        config,
        '/jobs/' + job.jobId + '/result',
        { ok: false, code },
        job.lease,
      ).catch(() => {});
    }
    console.error('No se confirmó el laminado:', error.code || error.message);
  } finally {
    clearInterval(heartbeat);
    controller.abort();
    await rm(folder, { recursive: true, force: true });
  }
}
async function setup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const site = siteOrigin(
      (await rl.question('Sitio [' + SITE + ']: ')).trim() || SITE,
    );
    const defaultExe =
      process.platform === 'win32'
        ? 'C:\\Program Files\\Bambu Studio\\bambu-studio.exe'
        : 'bambu-studio';
    const executable =
      (await rl.question('Ruta de Bambu Studio [' + defaultExe + ']: '))
        .trim()
        .replace(/^"|"$/g, '') || defaultExe;
    console.log(
      'Usá perfiles completos y revisados de máquina A1, proceso y filamentos. Hay un ejemplo de configuración en el repositorio.',
    );
    const profilePath = path.resolve(
      (await rl.question('Ruta del archivo JSON de perfiles locales: '))
        .trim()
        .replace(/^"|"$/g, ''),
    );
    const settings = JSON.parse(await readFile(profilePath, 'utf8'));
    const profiles = await loadProfiles(settings, path.dirname(profilePath));
    const help = await runSlicer(executable, ['--help'], { timeoutMs: 30000 });
    for (const flag of [
      '--slice',
      '--scale',
      '--load-settings',
      '--load-filaments',
      '--export-3mf',
    ])
      if (!help.includes(flag))
        throw Error(
          'Esta versión de Bambu Studio no ofrece la interfaz requerida.',
        );
    const code = (
      await rl.question(
        'Código de vinculación de Administración → Presupuestos 3D: ',
      )
    )
      .trim()
      .replace(/\s/g, '')
      .toUpperCase();
    const secret = randomBytes(32).toString('hex');
    const response = await fetch(site + '/api/slicer-worker/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        secret,
        profiles: profiles.map(({ id, name, material }) => ({
          id,
          name,
          material,
        })),
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Error(
        'No se pudo vincular la PC. Revisá el código y su vencimiento.',
      );
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(profiles))
      .digest('hex');
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
    await writeFile(
      configPath,
      JSON.stringify({ site, secret, executable, profilePath, fingerprint }),
      { mode: 0o600 },
    );
    console.log(
      'PC vinculada. Ejecutá: node "' +
        fileURLToPath(import.meta.url) +
        '" start',
    );
  } finally {
    rl.close();
  }
}
async function start() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.site = siteOrigin(config.site);
  if (!/^[a-f0-9]{64}$/.test(config.secret))
    throw Error('Volvé a ejecutar setup.');
  const settings = JSON.parse(await readFile(config.profilePath, 'utf8')),
    profiles = await loadProfiles(settings, path.dirname(config.profilePath));
  if (
    createHash('sha256').update(JSON.stringify(profiles)).digest('hex') !==
    config.fingerprint
  )
    throw Error(
      'Los perfiles cambiaron. Revisalos y volvé a vincular la PC antes de procesar solicitudes.',
    );
  console.log(
    'Mundo 3D: esperando trabajos. Dejá esta ventana abierta; Ctrl+C para detener.',
  );
  for (;;) {
    try {
      const response = await request(config, '/claim', {});
      if (response.status !== 204)
        await processJob(config, profiles, await response.json());
    } catch (e) {
      if (e.status === 401)
        throw Error(
          'La conexión fue revocada o venció. Volvé a vincular la PC.',
        );
      console.error(
        'Sin conexión con el sitio. Las solicitudes siguen pendientes.',
      );
    }
    await pause(20000);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const command = process.argv[2] || 'help';
  try {
    if (command === 'setup') await setup();
    else if (command === 'start') await start();
    else
      console.log(
        'Mundo 3D — node slicer-worker.mjs setup | start\nPrimero vinculá la PC desde administración y configurá los perfiles de tu A1.',
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
