import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildSliceArgs,
  parseSliceStats,
  zipText,
  siteOrigin,
  loadProfiles,
  runSlicer,
} from '../../../scripts/slicer-worker.mjs';
import { zipArchive } from './helpers/three-mf-fixtures.js';
const stats =
  '<config><plate><metadata key="prediction" value="3600"/><filament used_g="10"/><filament used_g="2"/></plate><plate><metadata key="prediction" value="1800"/><metadata key="weight" value="5"/></plate></config>';
test('estadísticas suman todas las placas, sin multiplicar cantidad ni omitir consumo', () => {
  assert.deepEqual(parseSliceStats(stats), {
    grams: 17,
    seconds: 5400,
    plates: 2,
  });
  assert.throws(() => parseSliceStats('<config><plate/></config>'));
  assert.throws(() => parseSliceStats('<!DOCTYPE x>' + stats));
});
test('lector acotado de ZIP y argumentos no incluyen impresión ni comandos del cliente', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'slicer-test-'));
  try {
    const file = path.join(dir, 'sample.3mf');
    await writeFile(file, zipArchive({ 'Metadata/slice_info.config': stats }));
    assert.equal(await zipText(file, 'Metadata/slice_info.config'), stats);
    assert.equal(await zipText(file, 'missing'), null);
    const args = buildSliceArgs(
      { format: '3mf', scale: 1.5 },
      'modelo.3mf',
      'salida.3mf',
      'maquina.json',
      'proceso.json',
      ['PLA.json'],
    );
    assert(args.includes('--scale'));
    assert(args.includes('1.5'));
    assert(!args.some((a) => /print|upload|http/i.test(a)));
    assert.throws(() =>
      buildSliceArgs({ format: 'glb', scale: 1 }, '', '', '', '', []),
    );
    await assert.rejects(
      runSlicer(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], {
        timeoutMs: 50,
      }),
      (e) => e.code === 'TIMEOUT',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('configuración exige A1, perfiles completos y origen seguro', async () => {
  assert.equal(
    siteOrigin('https://impresion-3d.onrender.com'),
    'https://impresion-3d.onrender.com',
  );
  assert.throws(() => siteOrigin('https://usuario:secreto@example.com'));
  assert.throws(() => siteOrigin('http://example.com'));
  await assert.rejects(loadProfiles({ profiles: [] }));
});

test('acepta perfiles completos de A1 y rechaza un preset heredado o A1 mini', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'slicer-profiles-'));
  try {
    const machine = {
      name: 'A1 completa',
      from: 'system',
      type: 'machine',
      printer_model: 'Bambu Lab A1',
      nozzle_diameter: ['0.4'],
      printable_area: ['0x0', '256x0', '256x256', '0x256'],
    };
    const process = {
      name: 'Proceso completo',
      from: 'system',
      type: 'process',
      layer_height: '0.2',
      wall_loops: '2',
      sparse_infill_density: '15%',
    };
    const filament = {
      name: 'PLA completo',
      from: 'system',
      type: 'filament',
      filament_type: ['PLA'],
      nozzle_temperature: ['220'],
      filament_density: ['1.24'],
      filament_diameter: ['1.75'],
    };
    await Promise.all([
      writeFile(path.join(dir, 'machine.json'), JSON.stringify(machine)),
      writeFile(path.join(dir, 'process.json'), JSON.stringify(process)),
      writeFile(path.join(dir, 'filament.json'), JSON.stringify(filament)),
    ]);
    const config = {
      profiles: [
        {
          id: 'pla',
          name: 'PLA de prueba',
          material: 'PLA',
          machine: 'machine.json',
          process: 'process.json',
          filaments: ['filament.json'],
        },
      ],
    };
    assert.equal(
      (await loadProfiles(config, dir))[0].machine.printer_model,
      'Bambu Lab A1',
    );
    await writeFile(
      path.join(dir, 'machine.json'),
      JSON.stringify({ ...machine, printer_model: 'Bambu Lab A1 mini' }),
    );
    await assert.rejects(
      loadProfiles(config, dir),
      (e) => e.code === 'PROFILE_INVALID',
    );
    await writeFile(
      path.join(dir, 'machine.json'),
      JSON.stringify({
        type: 'machine',
        name: 'Heredado',
        from: 'user',
        inherits: 'A1',
      }),
    );
    await assert.rejects(
      loadProfiles(config, dir),
      (e) => e.code === 'PROFILE_INVALID',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
