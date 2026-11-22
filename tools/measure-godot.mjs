// Misura l'import e il caricamento di moglia.glb in Godot 4 (headless).
//   npm run glb          genera spike/moglia.glb
//   npm run spike:godot  copia il modello, importa e misura
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GODOT = process.env.GODOT || 'godot';
const ROOT = path.resolve('spike');
const GLB = path.join(ROOT, 'moglia.glb');
const PROJECT = path.join(ROOT, 'godot');
const LOCAL_GLB = path.join(PROJECT, 'moglia.glb');

if (!fs.existsSync(GLB)) {
  console.error('Manca spike/moglia.glb: lancia prima `npm run glb`.');
  process.exit(1);
}
fs.copyFileSync(GLB, LOCAL_GLB);

function run(args, timeout = 180000) {
  const t0 = Date.now();
  const r = spawnSync(GODOT, args, { encoding: 'utf8', timeout });
  return { status: r.status, signal: r.signal, out: (r.stdout || '') + (r.stderr || ''), ms: Date.now() - t0 };
}

// primo avvio: importa le risorse e crea la cache .godot
const imp = run(['--headless', '--path', PROJECT, '--import'], 300000);
const importLine = imp.out.split('\n').filter((l) => /MOGLIA|ERROR|SCRIPT ERROR/.test(l)).join('\n');
console.log(`GODOT import_totale_ms=${imp.ms} exit=${imp.status}`);
if (imp.out.includes('ERROR')) console.log(importLine);

// secondo avvio: caricamento a cache calda, script di misura
const runRes = run(['--headless', '--path', PROJECT, '--quit-after', '600'], 180000);
const lines = runRes.out.split('\n').filter((l) => /MOGLIA/.test(l));
if (lines.length) console.log(`GODOT avvio_totale_ms=${runRes.ms}`, lines.join(' | '));
else console.log('GODOT nessuna misura. Output:\n' + runRes.out.slice(-2000));
