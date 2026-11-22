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

// scelta dell'omino (Moglia Online)
const chr = await page.evaluate(() => {
  const cards = document.querySelectorAll('.char');
  if (cards[2]) cards[2].click();
  return { n: cards.length, idx: window.__game.charIdx, name: window.__game.CHARACTERS[window.__game.charIdx].name };
});
if (chr.n !== 4 || chr.idx !== 2) await fail('selezione personaggio non funzionante: ' + JSON.stringify(chr));
console.log('✓ scelta omino:', chr.name);

await page.click('#play');
await page.waitForTimeout(1000);
const applied = await page.evaluate(() => ({ maxHp: window.__game.maxHp, garage: window.__game.garage.name, osm: window.__game.garage.osm }));
if (applied.maxHp !== 110) await fail('statistiche del personaggio non applicate: ' + JSON.stringify(applied));
if (!/Gasparini/.test(applied.garage)) await fail('officina non impostata su Officina Gasparini: ' + applied.garage);
console.log('✓ omino applicato · officina:', applied.garage, applied.osm ? '(OSM)' : '(fallback progetto)');

const startCar = await page.evaluate(() => {
  const g = window.__game, c = g.starterCar;
  return c ? { d: Math.hypot(c.x - g.P.x, c.z - g.P.z), type: c.type } : null;
});
if (!startCar || startCar.d > 12) await fail('nessun mezzo di trasporto davanti al giocatore: ' + JSON.stringify(startCar));
console.log('✓ mezzo pronto davanti al giocatore:', startCar.type, Math.round(startCar.d) + ' m');

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

// --- funzioni in stile GTA V ---
const radio = await page.evaluate(() => {
  const g = window.__game, before = g.station; g.radioSwitch();
  return { before, after: g.station, stations: g.STATIONS.length };
});
if (radio.stations < 2 || radio.after === radio.before) await fail('la radio non cambia stazione');
console.log('✓ radio in auto');

const gar = await page.evaluate(() => {
  const g = window.__game, before = g.P.car.spec.maxV;
  g.tuneCar(g.P.car, 1); g.paintCar(g.P.car, '#ff00ff');
  return { tuned: g.P.car.spec.maxV > before, hex: g.P.car.mesh.userData.bodyMats[0].color.getHexString() };
});
if (!gar.tuned || gar.hex !== 'ff00ff') await fail('officina: elaborazione o vernice non applicate');
console.log('✓ officina e personalizzazione');

const crash = await page.evaluate(() => {
  const g = window.__game, c = g.P.car;
  const before = c.health;
  g.damageCar(c, 40, true);
  const after = c.health;
  g.repairCar(c);
  return { before, after, repaired: c.health, mass: c.mass };
});
if (!(crash.after < crash.before) || crash.repaired !== 100 || !(crash.mass > 500)) await fail('danni/riparazione auto: ' + JSON.stringify(crash));
console.log('✓ danni, massa e riparazione auto');

await page.evaluate(() => window.__game.crime(2));
await page.waitForTimeout(1500);
const wanted = await page.evaluate(() => ({ lvl: window.__game.wanted.level, cops: window.__game.cops.length }));
if (wanted.lvl < 2 || wanted.cops < 1) await fail('ricercato o polizia non attivi: ' + JSON.stringify(wanted));
console.log('✓ ricercato e inseguimento');
await page.evaluate(() => window.__game.clearWanted());
await page.waitForTimeout(500);

// il rendering software può essere lentissimo: si aspetta che il sole cambi davvero
const day = await page.evaluate(async () => {
  const g = window.__game; const wait = async (cond) => { const t0 = performance.now(); while (performance.now() - t0 < 8000 && !cond()) await new Promise(r => setTimeout(r, 100)); };
  g.setTod(23); await wait(() => g.sunIntensity < 0.5); const night = g.sunIntensity;
  g.setTod(12); await wait(() => g.sunIntensity > 1.5); const noon = g.sunIntensity;
  return { night, noon };
});
if (!(day.night < day.noon)) await fail('ciclo giorno/notte non cambia il sole: ' + JSON.stringify(day));
console.log('✓ ciclo giorno/notte');

await page.evaluate(() => {
  const g = window.__game; if (g.P.car) { g.P.car.speed = 0; g.P.car.vf = 0; g.P.car.vel.set(0, 0); g.toggleCar(); }
});
await page.waitForTimeout(300);

const hurt = await page.evaluate(() => { const g = window.__game; g.damage(30); return { hp: g.hp, armor: g.armor }; });
if (hurt.hp >= 100) await fail('la salute non scende dopo un danno');
console.log('✓ salute e armatura');

const found = await page.evaluate(() => {
  const g = window.__game; const p = g.panini.find(q => !q.got);
  if (!p) return false; g.P.x = p.x; g.P.z = p.z; return true;
});
await page.waitForTimeout(900);
const panini = await page.evaluate(() => window.__game.stats.panini);
if (!found || panini < 1) await fail('collezionabile non raccolto');
console.log('✓ panini collezionabili');

const phone = await page.evaluate(() => { const g = window.__game; g.openPhone(); const open = document.getElementById('phone').style.display === 'block'; g.closePhone(); return open; });
if (!phone) await fail('telefono non si apre');
console.log('✓ telefono');

const counts = await page.evaluate(() => ({ veicoli: window.__game.vehicles.length, pedoni: window.__game.peds.length, missioni: window.__game.givers.length, panini: window.__game.panini.length, stunt: window.__game.stunts.length }));
console.log('✓ mondo popolato', JSON.stringify(counts));
if (errors.length) await fail('errori nella pagina:\n' + errors.join('\n'));
console.log('✓ nessun errore JavaScript');
await browser.close();
