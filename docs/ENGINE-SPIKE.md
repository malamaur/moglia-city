# Prova motori: Three.js, Godot 4, Unity WebGL

Data: 22 novembre 2026. Obiettivo: capire quanto pesa caricare la **stessa città OSM** in motori diversi, prima di decidere se lasciare Three.js. La prova usa un export semplificato della mappa, non il gioco completo.

## Cosa è stato misurato

`tools/export-glb.mjs` legge `data/moglia.json` e genera `spike/moglia.glb`:

| Proprietà | Valore |
|---|---|
| Dimensione | 4,66 MB |
| Triangoli | 67.528 |
| Mesh | 32 (una per colore) |
| Materiali | 32, colori piatti, nessuna texture |
| Contenuto | terreno, aree, strade, canali, ferrovia, edifici con muri e tetto |
| Escluso | texture, alberi, landmark modellati, veicoli, pedoni, HUD |

Il GLB è generato e **non versionato** (`npm run glb`).

## Ambiente

- Mac Apple Silicon (`arm64`), macOS Darwin 25.6.0.
- Node 23.11.0, Three.js 0.187.0, Playwright 1.65.1 (Chromium headless shell 159).
- Godot 4.7.2 stable.
- Unity non installato: nessuna misura.

## Risultati

| Misura | Three.js (Chromium headless) | Godot 4.7.2 (headless) | Unity WebGL |
|---|---|---|---|
| Payload applicativo | 4,66 MB GLB + 1,38 MB bundle JS | 4,66 MB GLB (motore già installato) | non misurato |
| Download locale del GLB | 25,5 ms | — | — |
| Parsing / caricamento | 4,0 ms | 6,2 ms (cache calda) | — |
| Istanziazione in scena | inclusa nel parse | 0,0 ms | — |
| Primo frame | 29,1 ms (rendering software) | non significativo in headless | — |
| Tempo totale osservato | 58,6 ms dal fetch al primo frame | 461 ms avvio+messa in scena | — |
| Import iniziale | — | 1,2–1,9 s una volta sola (cache editor) | — |
| Mesh | 32 | 1 (unite dall'importatore) | — |
| Installazione richiesta | un browser | Godot (~200 MB) | Unity (diversi GB) |

Comandi per riprodurre:

```bash
npm run glb
npm run spike:three
npm run spike:godot
```

## Come leggere i numeri

- **Il GLB non è il collo di bottiglia.** Sessantasettemila triangoli si caricano in pochi millisecondi sia in Three.js sia in Godot. La differenza percepita tra i motori non viene dal modello: viene dal motore, dai materiali, dalle texture, dall'illuminazione e dalle ombre.
- **Three.js paga il bundle della libreria** (1,38 MB compresso in questa prova, 1,1 MB il gioco completo) ma non ha runtime separato: la pagina parte subito.
- **Godot paga l'avvio del motore** (circa 0,4 s in questa prova native headless) e l'import iniziale, ma poi tiene la scena in una sola mesh. L'export web aggiungerebbe decine di MB di engine e qualche secondo di caricamento: non misurato qui perché servono i template di export.
- **Unity WebGL** aggiungerebbe il runtime più pesante e i tempi più lunghi, ma senza una build reale sarebbe un'opinione, non un dato: per questo non è in tabella.
- I tempi di rendering vanno presi con le molle: Three.js gira con SwiftShader (software) e Godot in headless. Servono a confrontare caricamento e avvio, non il frame rate.

## Cosa cambierebbe in un porting

La geometria è già esportabile, quindi il dato OSM non è un problema. Il lavoro vero è il gameplay: veicoli, collisioni, pedoni, missioni, HUD, audio, salvataggi. In Three.js esistono già; in Godot e Unity andrebbero riscritti.

| Voce | Three.js | Godot 4 | Unity |
|---|---|---|---|
| Codice gameplay attuale | riusato | riscritto | riscritto |
| Pipeline OSM | riusata | riusata via GLB | riusata via GLB |
| Peso web | ~6 MB totali in questa prova | ~20–40 MB stimati | decine di MB |
| Editor | no | sì, leggero | sì, pesante |
| Test automatici | Playwright già pronti | da rifare | da rifare |

## Conclusione

Per Moglia City **la mappa non giustifica un cambio di motore**: si carica ovunque in pochi millisecondi. Se il progetto resta un gioco web leggero e condivisibile, Three.js è la scelta giusta. Godot 4 ha senso solo se l'editor e i sistemi integrati valgono i 20–40 MB in più e la riscrittura del gameplay. Unity ha senso se il piano diventa multipiattaforma con contenuti e team.

Prossimo passo utile, se si vuole proseguire: esportare il progetto Godot in WebGL (serve scaricare i template di export) e misurare il caricamento reale nel browser; per Unity serve installare l'editor e fare la stessa build.
