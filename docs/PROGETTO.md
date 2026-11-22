# Moglia City — note di progetto

Stato al 22 novembre 2026. Questo file raccoglie requisiti, decisioni, dati verificati e cose ancora aperte. Chi riprende il progetto parte da qui.

## Requisiti del committente (verbatim)

1. "Fai una lista di 10 funzioni di GTA 5 più amate dagli utenti e implementiamole dentro Moglia City."
2. "Tutte le informazioni relative alle interazioni come l'officina devono essere prese da OpenStreetMap, per esempio l'officina deve essere l'Officina Gasparini."
3. "Va integrato assolutamente l'online con possibilità di scegliere un omino tra quelli proposti."
4. "Segna tutte queste informazioni a livello di progetto su file .md."
5. Preferenza operativa: non chiedere permessi per i comandi; il progetto ha `.claude/settings.local.json` in modalità `bypassPermissions`.

## Obiettivo

Mini open world 3D nel browser ambientato a **Moglia (MN)**, con le vie, gli edifici e i luoghi reali presi da OpenStreetMap. Il gioco deve prendere spunto dalle funzioni più amate di GTA V e GTA Online, restando un singolo file statico (`dist/index.html`).

## Regola sui luoghi

**Tutte le informazioni relative alle interazioni (officina, negozi, panini, kit, missioni, contatti del telefono) devono venire da OpenStreetMap.** Niente nomi o luoghi inventati quando il dato OSM esiste già nell'estratto.

- I punti vengono cercati in `data/moglia.json` (campi `pois` e `buildings`), generato da `tools/osm2json.py` a partire da `data/moglia.osm`.
- Per aggiungere o spostare un'interazione: si aggiorna il dato OSM (Overpass/editor OSM), si rilancia `npm run fetch-osm && npm run data`, e il gioco lo trova da solo.
- Attribuzione e licenza ODbL restano obbligatorie (vedi README).

### Luoghi OSM disponibili nell'estratto attuale

Riquadro: `10.893,44.922,10.930,44.945` (lon/lat, centro di Moglia).

POI con nome:

| Nome | Tipo OSM |
|---|---|
| Panificio Ada | shop=general |
| Benassi & Cavaletti Snc | shop=bakery |
| MD | shop=supermarket |
| Alice | amenity=bar |
| K2 | amenity=ice_cream |
| Aquila D'Oro | amenity=restaurant |
| IP | amenity=fuel |
| Intesa Sanpaolo | amenity=bank |
| Banca Agricola Mantovana | amenity=bank |
| BPER | amenity=bank |
| Poste Italiane | amenity=post_office |

Nell'estratto non esistono officine (`shop=car_repair`) né farmacie.

## Officina Gasparini — verifica OSM

Requisito: l'officina del gioco deve essere la **Officina Gasparini**.

Verifiche fatte sui dati OSM pubblici il 22/11/2026:

- Overpass, bbox allargata `44.88,10.80,45.00,11.05`, ricerca `name~"Gasparini"`: solo **Via Gasparini** (44.961, 10.947 — fuori dal riquadro di gioco) e **Scuola Primaria "Rino Gasparini"** (44.917, 10.987).
- Overpass, `shop=car_repair` nella stessa area: un solo risultato, **senza nome**, a 44.963, 10.999 (fuori dal riquadro).
- Overpass, ricerca `name~"officina|garage|auto|motori"`: **Auto Officina Falcin** (44.895, 10.899, a sud del riquadro) e **Officina Meccanica Fabbricese** (44.939, 10.803, a ovest, fuori).
- Nominatim, `Officina Gasparini Moglia`: **0 risultati**.

**Conclusione: l'Officina Gasparini non è mappata su OSM.** Il gioco quindi:

1. cerca un POI/edificio OSM che corrisponda a `officina|gasparini|meccanico|autoriparazion|car_repair|garage` (`findOsmPlace` in `src/main.js`);
2. se lo trova, mette lì l'officina e usa il nome OSM;
3. altrimenti usa il nome **Officina Gasparini** (indicazione esplicita del committente) in Piazza Marconi. In questo caso `garage.osm === false` e il punto non è ancora validato su OSM.

Per renderla davvero OSM: aggiungere l'attività su OpenStreetMap (es. nodo con `shop=car_repair`, `name=Officina Gasparini`), poi `npm run fetch-osm && npm run data`. Il gioco la sposta e la rinomina da solo.

## Funzioni in stile GTA (11)

| # | Funzione | Stato | Dove |
|---|---|---|---|
| 1 | Livello di ricercatezza e inseguimenti della Polizia Locale | fatto | `wanted`, `cops`, `setWanted`, `updateCop` in `src/main.js` |
| 2 | Radio in auto con 3 stazioni procedurali | fatto | `STATIONS`, `radioTick`, `scheduleStep` |
| 3 | Salute, armatura, danni, kit di pronto soccorso | fatto | `hp`, `armor`, `damagePlayer`, `ko`, `pickups` |
| 4 | Officina e personalizzazione auto (vernice, motore) | fatto | `garage`, `paintCar`, `tuneCar`, pannello `#garage` |
| 5 | Stunt jump con rampe | fatto | `stunts`, `stuntTick`, `landCar` |
| 6 | Collezionabili (20 panini) | fatto | `panini`, `updatePickups`; prime posizioni su POI food OSM |
| 7 | Trucchi digitati | fatto | `CHEATS`, `keyCheat` |
| 8 | Telefono con contatti e statistiche | fatto | pannello `#phone`, `renderPhone`, `bribe` |
| 9 | Ciclo giorno/notte | fatto | `tod`, `updateDayNight`, `skyAt` |
| 10 | Statistiche e obiettivi (achievement) | fatto | `stats`, `ACHIEVEMENTS`, `checkAchievements` |
| 11 | Moglia Online: scelta dell'omino | fatto (single player) | `CHARACTERS`, `selectCharacter`, pannello `#chars` |

### Scelta dell'omino (GTA Online)

Quattro personaggi proposti all'avvio, con statistica diversa:

| Omino | Effetto |
|---|---|
| Luca — il veloce | corre il 15% più veloce |
| Ada — la fornaia | 140 di salute invece di 100 |
| Gigi — il meccanico | sconto 20% in officina |
| Sara — la turista | +200 € all'ingresso |

**Limite dichiarato:** non c'è ancora il multiplayer reale. Per giocare in due serve un backend (WebSocket/server autoritativo) e quindi hosting: il gioco oggi è un file statico senza servizi esterni. La schermata si chiama "Moglia Online" perché riproduce la selezione personaggio in stile GTA Online. Il multiplayer è la prossima decisione aperta.

## Lingua, dialetto e localizzazione JSON

Richiesta del 22/11/2026: "tutte le conversazioni e messaggi vanno in dialetto mogliese". Il 22/11 è stato aggiunto anche: "estrapola tutto il testo dentro un file json localizzato".

**Tutti i testi di gioco stanno in `src/lang/`**, senza stringhe utente sparse nel codice:

- `it.json` è la **lingua predefinita**.
- `mogliese.json` è una **bozza dialettale non verificata**, attivabile con `?lang=mogliese` (la scelta viene ricordata in `localStorage`). Il 22/11 Federico ha segnalato che non corrisponde al dialetto parlato a Moglia: va corretta con un parlante locale prima di usarla come default.

Il 22/11/2026 Federico ha anche chiesto di rispondere in italiano in chat: la chat non va più in dialetto.

- `src/main.js` importa i due JSON, espone `t('gruppo.chiave', { var })` e sostituisce i segnaposto `{var}`. Le parti statiche di `src/index.template.html` hanno attributi `data-i18n="gruppo.chiave"` e vengono riempite da `applyI18n()` all'avvio. `window.__game.lang` indica la lingua attiva e `window.__game.setLang('it'|'mogliese')` la cambia.
- I JSON contengono: caricamento, schermata iniziale, comandi, personaggi, missioni, obiettivi, HUD, mappa, officina, telefono, trucchi, particelle/incidenti, voci dei pedoni, veicoli, meteo, audio.
- Per aggiungere una lingua: si copia `it.json`, si traducono i valori lasciando le chiavi, si importa in `src/main.js` e si aggiunge alla scelta in `pickLang()`.
- I **nomi dei luoghi OSM** (Panificio Ada, Piazza Guglielmo Marconi, Via Giacomo Leopardi…), i nomi propri di strade/piazze/attività, le stazioni radio e la nota di licenza ODbL restano nella forma originale: sono dati o obblighi di attribuzione, non testo traducibile.

### Base linguistica

Moglia non ha un vocabolario dedicato online: parla il **dialetto basso mantovano** (emiliano dell'Oltrepò mantovano), in transizione con ferrarese, mirandolese e guastallese. Fonti usate:

- Wikipedia, "Dialetto basso mantovano": elenco dei comuni (Moglia inclusa), pronomi (mì, tì, lü, lé, lór), forme verbali (a vègn, tì 't sè), lessico (nisün, gnint, mèi, incö, dmàn), infiniti (far, andàr, dar, ésar).
- Wikimapia, "Comune di Moglia": il nome locale di Moglia è **La Mòja**.
- Marco Moretti, *Al Paradis*, poesie nel dialetto dell'area Suzzara–Pegognaga–Gonzaga–Moglia–San Benedetto Po (indicato nella scheda Academia.edu).

La grafia in `mogliese.json` è una **bozza di basso mantovano** ("La Mòja", "Zöga", "sèrn", "sàra", "Te sèrve n'auto", "L'è rivà la nebbia", "mutór"). Non esiste una grammatica normativa del mogliese e la fonetica varia molto anche tra paesi vicini. **Federico ha confermato che non è il parlato di Moglia.** Per questo:

- la lingua predefinita è l'italiano (`it.json`);
- la bozza dialettale resta separata e si attiva solo con `?lang=mogliese`;
- le correzioni vanno fatte nei valori di `src/lang/mogliese.json`, senza toccare le chiavi, idealmente con un parlante di Moglia o con un testo scritto in dialetto locale (poesie, racconti, trascrizioni).

## Mobile

Il 22/11/2026 Federico ha segnalato che da telefono il gioco non si avviava. Causa: la schermata iniziale, cresciuta con la scelta dell'omino, superava l'altezza del viewport e il body bloccato impediva di raggiungere il pulsante "Gioca".

Correzioni:

- `#intro` è ora scorrevole (`overflow-y:auto`, `touch-action:pan-y`, `overscroll-behavior:contain`) con la card centrata quando c'è spazio e scrollabile quando non c'è.
- su dispositivi touch la lista dei comandi da tastiera è nascosta (`body.touch .keys{display:none}`), così la schermata resta corta.
- fallback del renderer: se WebGL con `logarithmicDepthBuffer` non parte, si riprova senza; se WebGL manca del tutto compare un messaggio in `#loadmsg`.
- fallback per `CanvasRenderingContext2D.roundRect` (Safari precedenti), usato dalle etichette.

Verifica con Playwright su iPhone SE e iPhone 13 emulati: la schermata scorre, "Gioca" è cliccabile, l'HUD parte e il joystick touch sposta il personaggio (1,74 m in 1,5 s nel test). Nessun errore JavaScript.

## Fisica, incidenti e veicoli

Intervento del 22/11/2026, richiesto da Federico ("vorrei migliorare la fisica, gli incidenti, le macchine etc"):

- **Masse e impulsi**: ogni veicolo ha una massa (utilitaria 950 kg, berlina 1350, sportiva 1200, furgone 2300, camion 6500, autobus 11000, trattore 3200, apecar 450). Negli urti con il giocatore la quantità di moto si scambia tra i due mezzi, quindi un camion sposta un'utilitaria e non viceversa.
- **Danni alle auto**: salute 0–100. Sopra i 50 km/h circa un urto fa danni seri; sotto i 15 km/h quasi nulla. Sotto 50 di salute esce fumo dal cofano, a 0 l'auto prende fuoco, esplode e resta un relitto annerito. Se il giocatore è dentro viene sbalzato fuori e subisce danni.
- **Incidenti**: detriti con gravità e rimbalzo, scintille e fumo, ammortizzatore di camera, flash, esplosione con luce temporanea e suono. I pedoni vicini fuggono, il traffico si ferma e suona il clacson.
- **Guida**: rollio in curva, beccheggio in accelerazione e frenata, stop che si accendono, stridio degli pneumatici e segni neri sull'asfalto in derapata o con il freno a mano.
- **Nuovi veicoli**: sportiva (motore e tenuta superiori), camion e autobus, con modelli low-poly dedicati; camion e autobus circolano solo su strade principali/secondarie/terziarie.
- **HUD**: terza barra sotto salute e armatura, visibile solo in auto, con la salute del mezzo. L'officina ripara auto e vernice, con costo proporzionale al danno.
- **Test**: `npm test` verifica danni, massa e riparazione, oltre a tutto il resto.

Limite dichiarato: resta una fisica custom arcade (cerchi di collisione, nessun rigid body). Il passo successivo naturale, se serve un salto di qualità, è integrare un motore fisico (Rapier) per sospensioni, ribaltamenti e deformazioni vere.

## Interazioni e luoghi

| Interazione | Fonte del luogo |
|---|---|
| Missione pane — Panificio Ada | OSM (`shop=general`, nome) |
| Missione taxi — Piazza Guglielmo Marconi | OSM (strada) |
| Missione Giro di Moglia — Piazza della Libertà | OSM (strada) |
| Officina | nome richiesto "Officina Gasparini"; posizione OSM se presente, altrimenti Piazza Marconi (vedi sopra) |
| Panini (20) | 2 per ogni POI food OSM (bakery, general, supermarket, bar, ristorante, gelateria); i restanti su marciapiedi ricavati dalle strade OSM |
| Kit salute | POI OSM bar/ristoranti/gelaterie |
| Armatura | POI OSM banche/ATM/ufficio postale |
| Rampe stunt (5) | su tratti lunghi di strade OSM primary/secondary/tertiary |
| Contatti telefono | Panificio Ada, Piazza Marconi, Piazza della Libertà, Polizia Locale, Meteo |

## Mezzo di trasporto iniziale

Alla partenza c'è sempre una berlina dorata a circa 4,5 metri davanti al giocatore, con l'etichetta "🚗 E per salire": serve a entrare subito in gioco senza cercare un'auto parcheggiata. Il mezzo è garantito anche se il punto davanti al giocatore è occupato (in quel caso viene spostato sul vertice stradale OSM più vicino). L'etichetta sparisce appena si sale su un veicolo.

## Comandi

| Tasto | Azione |
|---|---|
| WASD / frecce | cammina, guida |
| Mouse | guarda intorno |
| Shift | corri |
| Spazio | salta / freno a mano |
| E | sali/scendi dal veicolo; in officina apre il pannello |
| Q / Z | stazione radio successiva / precedente |
| K | telefono |
| T | avanza di 2 ore |
| H | clacson |
| R | rimetti l'auto in strada |
| M | mappa |
| C | telecamera |
| N | nebbia |
| U | audio |
| Trucchi | digita `PANE`, `SALUTE`, `LIBERTA`, `TURBO`, `SOLE`, `NOTTE` |

## Dati e pipeline

```bash
npm run fetch-osm     # Overpass -> data/moglia.osm (bbox in tools/fetch-osm.sh)
npm run data          # tools/osm2json.py -> data/moglia.json
npm run dev           # http://localhost:8000
npm run build         # dist/index.html
npm test              # test Playwright (richiede npx playwright install chromium)
```

`data/moglia.json` è un database derivato da OSM: resta sotto ODbL. Non va modificato a mano per aggiungere luoghi: si aggiorna il dato OSM e si rigenera.

## Verifica

Al 22/11/2026:

- `npm run build` → `dist/index.html` 1.103 KB.
- `npm test` (Playwright, Chromium headless, rendering software) → tutti i controlli verdi: scelta omino, camminata, ingresso in auto, guida, radio, officina e vernice, ricercato e inseguimento, ciclo giorno/notte, salute, panini, telefono, nessun errore JavaScript.
- Il test controlla anche che l'officina si chiami "Officina Gasparini" e stampa se la posizione è OSM o fallback.

## Cose aperte

1. **Officina Gasparini su OSM**: mapparla su OpenStreetMap per uscire dal fallback.
2. **Multiplayer reale**: serve un server; decidere se farlo (WebSocket + stanza) o restare single player con selezione personaggio.
3. **Interazioni per negozi OSM**: collegare i POI OSM a funzioni di gioco (es. comprare un panino da Panificio Ada, gelato da K2).
4. **Ampliamento mappa**: le officine OSM più vicine (Falcin, Fabbricese) sono fuori dal riquadro attuale; per includerle va allargato il bbox, con aumento di peso e tempi di build.
5. **Motore**: prova comparativa fatta con lo stesso GLB in Three.js e Godot 4 (Unity non misurato). Risultati in `docs/ENGINE-SPIKE.md`: la mappa si carica in pochi millisecondi ovunque, quindi il cambio motore si giustifica solo per editor e sistemi integrati, non per il caricamento. Decisione attuale: restare su Three.js finché il gioco è web e single-file.
6. **Fisica vera**: se l'arcade attuale non basta, valutare Rapier (WASM) per rigid body, sospensioni e ribaltamenti. Costo: riscrittura della guida e dei pedoni, più ~1,5 MB di wasm.
