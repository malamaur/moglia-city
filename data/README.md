# Dati

`moglia.json` deriva da OpenStreetMap (© OpenStreetMap contributors) ed è distribuito con licenza ODbL 1.0.
Viene generato con `tools/osm2json.py` a partire dall'estratto `moglia.osm`, che non è versionato: si scarica con `npm run fetch-osm`.

Formato (coordinate in metri, x verso est, z verso sud, origine fissa sul centro storico: lat 44.9335, lon 10.9115):
- `roads`: `{t: tipo, w: larghezza, n: nome, o: senso unico, p: [x,z,…], i: indici nel grafo}`
- `buildings`: `{p: [x,z,…], h: altezza, k: r|i|c|f|x (residenziale, industriale, chiesa, rurale, crollato), n: nome}`
- `areas`, `lines`, `pois` (le frazioni hanno `a: "place:village"` o `"place:hamlet"`), `gv` (vertici del grafo stradale), `ext` (estensione)

Estratto attuale: tutto il comune di Moglia (confine amministrativo), scaricato il 22/11/2026.
