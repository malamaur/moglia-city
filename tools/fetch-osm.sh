#!/bin/sh
# Scarica da Overpass l'estratto OpenStreetMap per Moglia (MN).
#   sh tools/fetch-osm.sh            tutto il comune: capoluogo, Bondanello, Coazze, Trivellano…
#   BBOX=ovest,sud,est,nord sh tools/fetch-osm.sh   solo un riquadro (es. il vecchio centro: 10.893,44.922,10.930,44.945)
# Poi: npm run data
# L'origine delle coordinate resta sul centro storico (vedi tools/osm2json.py), quindi
# gli edifici fatti a mano non si spostano quando l'area si allarga.
set -e
mkdir -p data
if [ -n "$BBOX" ]; then
  echo "Scarico OSM per bbox $BBOX…"
  curl -fL --retry 3 -o data/moglia.osm "https://overpass-api.de/api/map?bbox=$BBOX"
else
  echo "Scarico OSM per tutto il comune di Moglia (confine amministrativo)…"
  curl -fL --retry 3 -o data/moglia.osm --data-urlencode "data@tools/comune-moglia.overpassql" https://overpass-api.de/api/interpreter
fi
echo "Fatto: data/moglia.osm ($(wc -c < data/moglia.osm) byte). Ora: npm run data"
