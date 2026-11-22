[out:xml][timeout:300];
area["boundary"="administrative"]["admin_level"="8"]["name"="Moglia"]->.a;
(
  way(area.a)["highway"]; way(area.a)["building"]; way(area.a)["landuse"]; way(area.a)["waterway"];
  way(area.a)["natural"]; way(area.a)["leisure"]; way(area.a)["amenity"]; way(area.a)["railway"]; way(area.a)["place"];
  relation(area.a)["building"]; relation(area.a)["landuse"]; relation(area.a)["natural"]; relation(area.a)["leisure"];
  node(area.a)["amenity"]; node(area.a)["shop"]; node(area.a)["tourism"]; node(area.a)["place"];
  node(area.a)["natural"="tree"]; node(area.a)["highway"="street_lamp"];
);
(._;>;);
out body;
