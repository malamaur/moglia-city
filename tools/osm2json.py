"""Converte un estratto OpenStreetMap (.osm XML) nel formato compatto usato dal gioco.

Uso: python3 tools/osm2json.py data/moglia.osm data/moglia.json
"""
import sys, json, math, random
import xml.etree.ElementTree as ET

src, dst = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()
b = root.find('bounds')
LAT0 = (float(b.get('minlat')) + float(b.get('maxlat'))) / 2
LON0 = (float(b.get('minlon')) + float(b.get('maxlon'))) / 2
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

out = {'gv': gv, 'lat0': LAT0, 'lon0': LON0, 'roads': roads, 'buildings': buildings, 'areas': areas, 'lines': lines, 'pois': pois,
       'ext': [round((float(b.get('minlon')) - LON0) * KX), round(-(float(b.get('maxlat')) - LAT0) * KZ),
               round((float(b.get('maxlon')) - LON0) * KX), round(-(float(b.get('minlat')) - LAT0) * KZ)]}
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print(len(roads), 'roads', len(buildings), 'buildings', len(areas), 'areas', len(lines), 'lines', len(pois), 'pois', out['ext'])
