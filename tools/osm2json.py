"""Converte un estratto OpenStreetMap (.osm XML) nel formato compatto usato dal gioco.

Uso: python3 tools/osm2json.py data/moglia.osm data/moglia.json
"""
import sys, json, math, random
import xml.etree.ElementTree as ET

src, dst = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()
import os
b = root.find('bounds')
if b is None:  # estratti Overpass per confine comunale: il riquadro si ricava dai nodi
    lats = [float(n.get('lat')) for n in root.iter('node')]; lons = [float(n.get('lon')) for n in root.iter('node')]
    b = {'minlat': min(lats), 'maxlat': max(lats), 'minlon': min(lons), 'maxlon': max(lons)}
else:
    b = {k: float(b.get(k)) for k in ('minlat', 'maxlat', 'minlon', 'maxlon')}
# Origine fissa sul centro storico: le coordinate del gioco (edifici rifatti a mano, fontana,
# monumento, officina) restano le stesse anche se l'estratto si allarga alle frazioni.
# Per tornare al centro del riquadro: MOGLIA_ORIGIN=auto
_o = os.environ.get('MOGLIA_ORIGIN', '44.933499999999995,10.9115')
if _o == 'auto':
    LAT0 = (b['minlat'] + b['maxlat']) / 2; LON0 = (b['minlon'] + b['maxlon']) / 2
else:
    LAT0, LON0 = (float(v) for v in _o.split(','))
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110574.0

nodes, ways, rels = {}, {}, []
node_tags = []
for el in root:
    if el.tag == 'node':
        x = (float(el.get('lon')) - LON0) * KX
        z = -(float(el.get('lat')) - LAT0) * KZ
        nodes[el.get('id')] = (round(x, 1), round(z, 1))
        t = {c.get('k'): c.get('v') for c in el if c.tag == 'tag'}
        if t: node_tags.append((el.get('id'), t))
    elif el.tag == 'way':
        nd = [c.get('ref') for c in el if c.tag == 'nd']
        t = {c.get('k'): c.get('v') for c in el if c.tag == 'tag'}
        ways[el.get('id')] = (nd, t)
    elif el.tag == 'relation':
        mem = [(c.get('type'), c.get('ref'), c.get('role')) for c in el if c.tag == 'member']
        t = {c.get('k'): c.get('v') for c in el if c.tag == 'tag'}
        rels.append((mem, t))

def pts(nd):
    out = []
    for r in nd:
        if r in nodes: out += list(nodes[r])
    return out

def join_rings(wlist):
    segs = [list(w) for w in wlist if w]
    rings = []
    while segs:
        cur = segs.pop(0)
        changed = True
        while cur[0] != cur[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == cur[-1]: cur += s[1:]
                elif s[-1] == cur[-1]: cur += s[::-1][1:]
                elif s[-1] == cur[0]: cur = s + cur[1:]
                elif s[0] == cur[0]: cur = s[::-1] + cur[1:]
                else: continue
                segs.pop(i); changed = True; break
        if len(cur) >= 4: rings.append(cur)
    return rings

ROADW = {'primary': 9, 'secondary': 8, 'tertiary': 7, 'secondary_link': 6, 'residential': 6,
         'unclassified': 5.5, 'service': 4, 'living_street': 5, 'pedestrian': 5,
         'track': 3, 'path': 2, 'footway': 2, 'cycleway': 2.5}

random.seed(7)
roads, buildings, areas, lines, pois = [], [], [], [], []

def height_of(t, area):
    if 'height' in t:
        try: return float(t['height'].replace('m', '').strip())
        except: pass
    if 'building:levels' in t:
        try: return float(t['building:levels']) * 3.1 + 1.0
        except: pass
    bt = t.get('building', 'yes')
    if bt == 'collapsed': return 1.6
    if bt in ('industrial', 'warehouse'): return random.choice([7, 8, 9, 10])
    if bt in ('farm', 'barn'): return 8
    if t.get('amenity') == 'place_of_worship': return 16
    if area < 30: return 3
    if area < 80: return random.choice([3.2, 4, 6.4])
    if area < 260: return random.choice([6.4, 6.4, 6.4, 7, 9.5])
    if area < 600: return random.choice([6.4, 7, 9.5, 9.5, 12.6])
    return random.choice([7, 9.5, 12.6])

def poly_area(p):
    a = 0
    for i in range(0, len(p) - 2, 2):
        a += p[i] * p[i + 3] - p[i + 2] * p[i + 1]
    return abs(a) / 2

def add_building(p, t):
    if len(p) < 8: return
    a = poly_area(p)
    bt = t.get('building', 'yes')
    kind = 'c' if t.get('amenity') == 'place_of_worship' else ('i' if bt in ('industrial', 'warehouse') else ('x' if bt == 'collapsed' else ('f' if bt in ('farm', 'barn') else 'r')))
    d = {'p': p[:-2], 'h': round(height_of(t, a), 1), 'k': kind}
    if t.get('name'): d['n'] = t['name']
    if t.get('amenity'): d['a'] = t['amenity']
    buildings.append(d)

def area_kind(t):
    if t.get('natural') == 'water' or t.get('waterway') == 'riverbank' or t.get('landuse') in ('reservoir', 'basin'): return 'water'
    if t.get('leisure') in ('park', 'garden', 'playground') or t.get('landuse') in ('grass', 'recreation_ground', 'village_green'): return 'park'
    if t.get('leisure') in ('pitch', 'sports_centre', 'stadium'): return 'pitch'
    if t.get('leisure') == 'swimming_pool': return 'pool'
    if t.get('amenity') == 'parking': return 'parking'
    if t.get('amenity') == 'grave_yard' or t.get('landuse') == 'cemetery': return 'cemetery'
    if t.get('natural') in ('wood', 'scrub') or t.get('landuse') in ('forest', 'orchard', 'vineyard'): return 'wood'
    if t.get('landuse') in ('farmland', 'meadow'): return 'farm'
    if t.get('landuse') == 'farmyard': return 'farmyard'
    if t.get('landuse') == 'industrial': return 'industrial'
    if t.get('landuse') == 'residential': return 'residential'
    if t.get('highway') == 'pedestrian' or t.get('place') == 'square': return 'square'
    return None

used_in_rel = set()
gidx, gv = {}, []
for mem, t in rels:
    if t.get('type') != 'multipolygon': continue
    outers = [ways[r][0] for (ty, r, role) in mem if ty == 'way' and r in ways and role in ('outer', '')]
    for (ty, r, role) in mem:
        if ty == 'way': used_in_rel.add(r)
    for ring in join_rings(outers):
        p = pts(ring)
        if 'building' in t: add_building(p, t)
        else:
            k = area_kind(t)
            if k: areas.append({'k': k, 'p': p[:-2]})

for wid, (nd, t) in ways.items():
    p = pts(nd)
    if len(p) < 4: continue
    closed = nd[0] == nd[-1]
    if 'building' in t:
        if closed: add_building(p, t)
        continue
    hw = t.get('highway')
    if hw in ROADW and not (hw == 'pedestrian' and closed and t.get('area') == 'yes'):
        ids = [n for n in nd if n in nodes]
        for n in ids:
            if n not in gidx: gidx[n] = len(gv) // 2; gv.extend(nodes[n])
        r = {'t': hw, 'w': ROADW[hw], 'p': p, 'i': [gidx[n] for n in ids]}
        if t.get('name'): r['n'] = t['name']
        if t.get('oneway') in ('yes', '1'): r['o'] = 1
        if t.get('bridge') == 'yes': r['b'] = 1
        roads.append(r)
        continue
    if t.get('waterway') in ('canal', 'river', 'ditch', 'drain', 'stream'):
        w = {'canal': 9, 'river': 14, 'ditch': 2.5, 'drain': 2.5, 'stream': 3}[t['waterway']]
        if t.get('width'):
            try: w = float(t['width'])
            except: pass
        d = {'k': 'water', 'w': w, 'p': p}
        if t.get('name'): d['n'] = t['name']
        lines.append(d); continue
    if t.get('railway') in ('abandoned', 'disused', 'rail'):
        lines.append({'k': 'rail', 'w': 3, 'p': p}); continue
    if closed:
        k = area_kind(t)
        if k: areas.append({'k': k, 'p': p[:-2]})

for nid, t in node_tags:
    x, z = nodes[nid]
    if t.get('amenity') or t.get('shop') or t.get('tourism') or (t.get('natural') == 'tree') or t.get('highway') == 'street_lamp':
        d = {'x': x, 'z': z}
        if t.get('name'): d['n'] = t['name']
        d['a'] = t.get('amenity') or ('shop:' + t['shop'] if t.get('shop') else (t.get('tourism') or t.get('natural') or t.get('highway')))
        pois.append(d)
    elif t.get('place') in ('village', 'hamlet', 'suburb', 'quarter', 'neighbourhood', 'locality', 'isolated_dwelling', 'town') and t.get('name'):
        # frazioni e località: nome grande visibile da lontano e sulla mappa
        pois.append({'x': x, 'z': z, 'n': t['name'], 'a': 'place:' + t['place']})

# Ritaglio: fiumi, canali e grandi aree (acqua, boschi) in OSM proseguono per decine di km.
# Si tengono solo dentro il riquadro di strade ed edifici, più un margine.
MARGIN = 300.0
_xs = [v for r in roads for v in r['p'][0::2]] + [v for bd in buildings for v in bd['p'][0::2]]
_zs = [v for r in roads for v in r['p'][1::2]] + [v for bd in buildings for v in bd['p'][1::2]]
CX0, CX1, CZ0, CZ1 = min(_xs) - MARGIN, max(_xs) + MARGIN, min(_zs) - MARGIN, max(_zs) + MARGIN
def _inside(x, z): return CX0 <= x <= CX1 and CZ0 <= z <= CZ1
def clip_line(p):
    out, cur = [], []
    for i in range(0, len(p), 2):
        if _inside(p[i], p[i + 1]): cur += [p[i], p[i + 1]]
        else:
            if len(cur) >= 4: out.append(cur)
            cur = []
    if len(cur) >= 4: out.append(cur)
    return out
def clip_poly(p):  # Sutherland-Hodgman sul rettangolo
    pts = [(p[i], p[i + 1]) for i in range(0, len(p), 2)]
    for axis, val, keep_ge in ((0, CX0, True), (0, CX1, False), (1, CZ0, True), (1, CZ1, False)):
        if not pts: break
        res = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            ina = (a[axis] >= val) if keep_ge else (a[axis] <= val)
            inb = (b[axis] >= val) if keep_ge else (b[axis] <= val)
            if inb:
                if not ina: res.append(_cut(a, b, axis, val))
                res.append(b)
            elif ina: res.append(_cut(a, b, axis, val))
        pts = res
    return [round(v, 1) for q in pts for v in q] if len(pts) >= 3 else None
def _cut(a, b, axis, val):
    t = (val - a[axis]) / ((b[axis] - a[axis]) or 1e-9)
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
_lines = []
for l in lines:
    for seg in clip_line(l['p']): _lines.append({**l, 'p': seg})
lines = _lines
_areas = []
for a in areas:
    q = a['p'] if all(_inside(a['p'][i], a['p'][i + 1]) for i in range(0, len(a['p']), 2)) else clip_poly(a['p'])
    if q: _areas.append({**a, 'p': q})
areas = _areas
pois = [d for d in pois if _inside(d['x'], d['z'])]
b = {'minlon': LON0 + CX0 / KX, 'maxlon': LON0 + CX1 / KX, 'maxlat': LAT0 - CZ0 / KZ, 'minlat': LAT0 - CZ1 / KZ}

out = {'gv': gv, 'lat0': LAT0, 'lon0': LON0, 'roads': roads, 'buildings': buildings, 'areas': areas, 'lines': lines, 'pois': pois,
       'ext': [round((b['minlon'] - LON0) * KX), round(-(b['maxlat'] - LAT0) * KZ),
               round((b['maxlon'] - LON0) * KX), round(-(b['minlat'] - LAT0) * KZ)]}
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print(len(roads), 'roads', len(buildings), 'buildings', len(areas), 'areas', len(lines), 'lines', len(pois), 'pois', out['ext'])
