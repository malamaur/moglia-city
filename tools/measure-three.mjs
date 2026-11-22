// Misura il caricamento di spike/moglia.glb in Three.js dentro Chromium headless.
//   npm run spike:three
// Stampa download, parsing, primo frame e triangoli; salva uno screenshot in /tmp.
import { build } from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('spike');
const PORT = Number(process.env.PORT || 8123);

await build({
  entryPoints: [path.join(ROOT, 'three-loader/main.js')],
  bundle: true, format: 'iife', write: true,
  outfile: path.join(ROOT, 'three-loader/bundle.js'),
  minify: false, legalComments: 'none', target: 'es2020',
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'three-loader/index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/three-loader/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__result, null, { timeout: 120000 });
  const result = await page.evaluate(() => window.__result);
  await page.screenshot({ path: '/tmp/moglia-three-glb.png' });
  const bundleKB = Math.round(fs.statSync(path.join(ROOT, 'three-loader/bundle.js')).size / 1024);
  console.log('THREE', JSON.stringify({ ...result, bundleKB }));
  if (errors.length) console.log('ERRORI', errors.join(' | '));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
