# Spike: la stessa città in Three.js, Godot e Unity

Serve a misurare quanto costa caricare **la stessa geometria OSM** in motori diversi, prima di decidere se abbandonare Three.js.

## Cosa c'è

```
spike/
  moglia.glb              città esportata da data/moglia.json (generata, non versionata)
  three-loader/           pagina minima che carica il GLB con Three.js
  godot/                  progetto Godot 4 minimo con main.tscn + main.gd
  unity/                  istruzioni e script di misura per Unity (non eseguito qui)
```

## Riprodurre

```bash
npm run glb          # data/moglia.json -> spike/moglia.glb (4,7 MB, 67.528 triangoli)
npm run spike:three  # bundle Three.js + Chromium headless, stampa i tempi
npm run spike:godot  # copia il GLB, importa in Godot e stampa i tempi
```

Risultati e interpretazione: [docs/ENGINE-SPIKE.md](../docs/ENGINE-SPIKE.md).

## Limiti dichiarati

- Il GLB contiene solo geometria con colori piatti: niente texture, alberi, landmark modellati, pedoni o veicoli.
- Three.js gira in Chromium headless con rendering software (SwiftShader): i tempi di rendering non sono quelli di una GPU vera.
- Godot è eseguito in headless: misura caricamento e istanziazione, non il frame rate.
- Unity non è installato su questa macchina: nessuna misura, solo la procedura.

Il modello non è pensato per sostituire il gioco: è un banco di prova per il caricamento della mappa.
