// Crea dist/index.html: un unico file con il gioco, Three.js e i dati della mappa incorporati.
//   node build.mjs            build di produzione (minificata)
//   node build.mjs --dev      server locale su http://localhost:8000 con ricostruzione automatica
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import http from 'node:http';

const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.PORT || 8000);

function assemble(js) {
  const data = fs.readFileSync('data/moglia.json', 'utf8').replace(/<\//g, '<\\/');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const html = fs.readFileSync('src/index.template.html', 'utf8')
    .replace('__DATA__', () => data)
    .replace('__BUNDLE__', () => safeJs);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/index.html', html);
  return html.length;
}

const options = {
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', write: false,
  target: 'es2020', legalComments: 'none', minify: !DEV, sourcemap: DEV ? 'inline' : false,
};

if (!DEV) {
  const r = await esbuild.build(options);
  const size = assemble(r.outputFiles[0].text);
  console.log(`dist/index.html pronto (${(size / 1024).toFixed(0)} KB)`);
} else {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{
      name: 'assemble',
      setup(b) {
        b.onEnd((r) => {
          if (r.errors.length) return;
          assemble(r.outputFiles[0].text);
          console.log(`[${new Date().toLocaleTimeString('it-IT')}] ricostruito`);
        });
      },
    }],
  });
  await ctx.watch();
  // ricostruisce anche quando cambiano il template o i dati
  for (const f of ['src/index.template.html', 'data/moglia.json']) fs.watchFile(f, { interval: 500 }, () => ctx.rebuild());
  http.createServer((req, res) => {
    const html = fs.existsSync('dist/index.html') ? fs.readFileSync('dist/index.html') : 'Build in corso…';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  }).listen(PORT, () => console.log(`Moglia City su http://localhost:${PORT}  (Ctrl+C per uscire)`));
}
