#!/bin/sh
# Scarica da Overpass l'estratto OpenStreetMap del centro di Moglia (MN).
# Per allargare l'area modifica BBOX (ovest,sud,est,nord), poi lancia `npm run data`.
set -e
BBOX="${BBOX:-10.893,44.922,10.930,44.945}"
mkdir -p data
echo "Scarico OSM per bbox $BBOX…"
curl -fL --retry 3 -o data/moglia.osm "https://overpass-api.de/api/map?bbox=$BBOX"
echo "Fatto: data/moglia.osm ($(wc -c < data/moglia.osm) byte). Ora: npm run data"
