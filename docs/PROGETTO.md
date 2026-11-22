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
