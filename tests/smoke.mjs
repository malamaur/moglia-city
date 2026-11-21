// Test di fumo: apre il gioco in un Chrome headless, preme "Gioca", cammina, sale in auto e guida.
// Fallisce se la pagina genera errori JavaScript o se il giocatore non si muove.
// Uso: npm test   (richiede `npx playwright install chromium` la prima volta)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = 'file://' + path.join(root, 'dist', 'index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// tiene premuto un tasto finché il giocatore non si è spostato di almeno `min` metri (o scade il tempo):
// il rendering software in CI è lento, quindi non si può contare su una durata fissa
async function holdUntilMoved(key, min, timeout = 20000) {
  const a = await pos(); await page.keyboard.down(key);
  const t0 = Date.now(); let b = a;
  while (Date.now() - t0 < timeout) { await page.waitForTimeout(250); b = await pos(); if (Math.hypot(b.x - a.x, b.z - a.z) >= min) break; }
  await page.keyboard.up(key); return Math.hypot(b.x - a.x, b.z - a.z);
}
const fail = async (msg) => { console.error('✗ ' + msg); await browser.close(); process.exit(1); };

await page.goto(url);
await page.waitForSelector('#play', { state: 'visible', timeout: 60000 });
await page.click('#play');
await page.waitForTimeout(1000);

const pos = () => page.evaluate(() => ({ x: window.__game.P.x, z: window.__game.P.z, car: !!window.__game.P.car }));
if (await holdUntilMoved('KeyW', 1.5) < 1.5) await fail('il personaggio non cammina');
console.log('✓ si cammina');

await page.evaluate(() => {
  // mette un'auto all'inizio del rettilineo più lungo di una strada principale, orientata lungo la strada
  const g = window.__game, D = g.W.D; let seg = null, bl = 0;
  for (const r of D.roads) if (r.t === 'primary' || r.t === 'secondary') for (let i = 0; i < r.p.length - 2; i += 2) {
    const l = Math.hypot(r.p[i + 2] - r.p[i], r.p[i + 3] - r.p[i + 1]); if (l > bl) { bl = l; seg = r.p.slice(i, i + 4); }
  }
  const car = g.vehicles.find(v => !v.ai) || g.vehicles[0]; car.ai = null; car.vf = 0;
  car.x = seg[0]; car.z = seg[1]; car.h = Math.atan2(seg[2] - seg[0], seg[3] - seg[1]);
  g.P.x = car.x + 1; g.P.z = car.z; g.toggleCar();
});
if (!(await pos()).car) await fail('non si riesce a salire in auto');
console.log('✓ si sale in auto');
{
  // con il rendering software il tempo di gioco scorre lento: si verifica che l'auto acceleri
  await page.keyboard.down('KeyW'); const t0 = Date.now(); let sp = 0;
  while (Date.now() - t0 < 30000) { await page.waitForTimeout(250); sp = await page.evaluate(() => window.__game.P.car.speed); if (sp > 2) break; }
  await page.keyboard.up('KeyW');
  if (sp <= 2) await fail("l'auto non accelera");
}
console.log('✓ si guida');

const counts = await page.evaluate(() => ({ veicoli: window.__game.vehicles.length, pedoni: window.__game.peds.length, missioni: window.__game.givers.length }));
console.log('✓ mondo popolato', JSON.stringify(counts));
if (errors.length) await fail('errori nella pagina:\n' + errors.join('\n'));
console.log('✓ nessun errore JavaScript');
await browser.close();
