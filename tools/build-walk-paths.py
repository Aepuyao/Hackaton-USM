#!/usr/bin/env python3
"""
Genera las aristas de graph.json a partir de los nodos (landmarks) y de la
red peatonal de OpenStreetMap (tools/osm-ways.json).

1. Para cada par de nodos cercanos calcula el recorrido caminando real.
2. Si el recorrido X → Y pasa cerca de otro nodo Z, NO se crea la arista X–Y:
   la ruta tendrá que pasar por Z (X → Z → Y). Así cada video cubre solo el
   tramo entre dos landmarks vecinos.
3. Escribe las aristas (ida y vuelta) con `path` (recorrido) y `seconds`.

Uso:
  python3 tools/build-walk-paths.py            # reescribe las aristas de graph.json
  python3 tools/build-walk-paths.py --dry-run  # solo muestra el reporte

Los nodos se editan a mano en graph.json; las aristas las genera este script.
Ajustes manuales: MANUAL_LINKS, NO_LINKS, BLOCKED_WAYS, EXTRA_LINKS (abajo).
"""
import heapq
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "graph.json"
OSM = ROOT / "tools" / "osm-ways.json"

WALK_SPEED = 1.2          # m/s
STEPS_PENALTY = 1.5       # las escaleras "cuestan" 50 % más
JOIN_GAP = 6              # m: une extremos de caminos que en OSM quedaron casi tocándose
MAX_LINK = 220            # m en línea recta: pares más lejanos no se consideran vecinos
MAX_DETOUR = 2.2          # si caminando sale > 2.2× la recta, se asume que falta un paso en OSM
MAX_WALK = 250            # m caminando: un tramo (un video) no debería ser más largo
NEAR = 25                 # m: si el recorrido pasa a menos de esto de otro nodo, se pasa por él
DETOUR_OK = 1.35          # se acepta pasar por otros landmarks si alarga hasta 35 %…
DETOUR_NEAR = 1.8         # …o hasta 80 % si el recorrido directo pasa pegado a ese landmark
# Solo se usan caminos dentro de esta caja (el campus); así no se sale a la calle
BBOX = (-33.0372, -71.5980, -33.0337, -71.5922)  # (sur, oeste, norte, este)

WALKABLE = {"footway", "steps", "pedestrian", "path", "corridor", "service",
            "living_street", "cycleway", "track"}
BLOCKED_WAYS = set()      # ids de ways de OSM por donde NO se puede pasar
# Pasillos interiores que sí se usan: túnel bajo Av. Los Placeres (Edificio C → Edificio P)
ALLOWED_INDOOR = {1278343174, 1278343192, 1278343127}
# Pasos que faltan en OSM (se agregan a la red). Cada extremo: id de nodo o (lat, lng)
EXTRA_LINKS = []
# Vecinos directos que OSM no conoce: se agregan en línea recta si OSM no da un camino razonable
MANUAL_LINKS = {
    ("edificio_t", "patio_canon"): "camino directo que no está en OSM",
    # Pendientes de confirmar en terreno (OSM solo da un rodeo grande):
    ("edificio_a", "patio_central"): "pendiente",
    ("biblioteca", "edificio_a"): "pendiente",
    ("gimnasio_1", "patio_central"): "pendiente",
    ("gimnasio_1", "piscina"): "pendiente",
    ("edificio_c", "piscina"): "pendiente",
    ("edificio_m", "porteria_valdes"): "pendiente",
}
# Pares que nunca deben conectarse directo (no se puede caminar entre ellos)
NO_LINKS = set()
# Tramos que se mantienen siempre, aunque pasen cerca de otro landmark
# (p. ej. porque ya se grabó ese video)
FORCED_LINKS = {
    ("ingenieria_comercial", "patio_central"),
}


def meters(a, b):
    (la1, lo1), (la2, lo2) = a, b
    r = 6371000
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def point_to_polyline(p, pts):
    """Distancia en metros de p a la polilínea pts (proyección local plana)."""
    kx = 111320 * math.cos(math.radians(p[0]))
    ky = 110540

    def xy(q):
        return ((q[1] - p[1]) * kx, (q[0] - p[0]) * ky)

    best = math.inf
    for a, b in zip(pts, pts[1:]):
        (ax, ay), (bx, by) = xy(a), xy(b)
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        t = 0 if L2 == 0 else max(0, min(1, -(ax * dx + ay * dy) / L2))
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


def in_bbox(p):
    s, w, n, e = BBOX
    return s <= p[0] <= n and w <= p[1] <= e


def build_network():
    """Grafo no dirigido: punto (lat, lng) → {vecino: costo}."""
    ways = json.loads(OSM.read_text())["elements"]
    adj = {}

    def link(a, b, factor=1.0):
        d = meters(a, b) * factor
        adj.setdefault(a, {})[b] = min(d, adj.get(a, {}).get(b, math.inf))
        adj.setdefault(b, {})[a] = min(d, adj.get(b, {}).get(a, math.inf))

    for w in ways:
        t = w.get("tags", {})
        if t.get("highway") not in WALKABLE or w["id"] in BLOCKED_WAYS:
            continue
        if t.get("foot") == "no" or (t.get("indoor") == "yes" and w["id"] not in ALLOWED_INDOOR):
            continue
        pts = [(round(g["lat"], 7), round(g["lon"], 7)) for g in w["geometry"]]
        if not all(in_bbox(p) for p in pts):
            continue
        factor = STEPS_PENALTY if t["highway"] == "steps" else 1.0
        for a, b in zip(pts, pts[1:]):
            link(a, b, factor)
        # Patios / plazas (área peatonal): se pueden cruzar en línea recta
        if t.get("area") == "yes" and t["highway"] == "pedestrian":
            ring = list(dict.fromkeys(pts))
            for i, a in enumerate(ring):
                for b in ring[i + 1:]:
                    link(a, b)

    # Une puntos muy cercanos que en OSM quedaron sin conectar
    pts = list(adj)
    for i, a in enumerate(pts):
        for b in pts[i + 1:]:
            if b not in adj[a] and meters(a, b) < JOIN_GAP:
                link(a, b)
    return adj


def components(adj):
    comp, n = {}, 0
    for start in adj:
        if start in comp:
            continue
        stack = [start]
        comp[start] = n
        while stack:
            u = stack.pop()
            for v in adj[u]:
                if v not in comp:
                    comp[v] = n
                    stack.append(v)
        n += 1
    return comp


def dijkstra(adj, src):
    dist, prev = {src: 0.0}, {}
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, c in adj[u].items():
            nd = d + c
            if nd < dist.get(v, math.inf):
                dist[v], prev[v] = nd, u
                heapq.heappush(pq, (nd, v))
    return dist, prev


def walk(prev, src, dst):
    path = [dst]
    while path[-1] != src:
        path.append(prev[path[-1]])
    return path[::-1]


def main():
    dry = "--dry-run" in sys.argv
    graph = json.loads(GRAPH.read_text())
    ids = [n["id"] for n in graph["nodes"]]
    pos = {n["id"]: (n["lat"], n["lng"]) for n in graph["nodes"]}
    name = {n["id"]: n["name"] for n in graph["nodes"]}
    key = lambda a, b: tuple(sorted((a, b)))

    adj = build_network()
    comp = components(adj)
    sizes = {}
    for c in comp.values():
        sizes[c] = sizes.get(c, 0) + 1
    main_comp = max(sizes, key=sizes.get)
    net = [p for p in adj if comp[p] == main_comp]

    # Cada nodo se "engancha" al punto más cercano de la red principal
    snap = {i: min(net, key=lambda x: meters(pos[i], x)) for i in ids}

    def as_point(x):
        if isinstance(x, str):
            adj.setdefault(pos[x], {})
            d = meters(pos[x], snap[x])
            adj[pos[x]][snap[x]] = adj[snap[x]][pos[x]] = d
            return pos[x]
        return tuple(x)
    for a, b in EXTRA_LINKS:
        pa, pb = as_point(a), as_point(b)
        adj.setdefault(pa, {})[pb] = adj.setdefault(pb, {})[pa] = meters(pa, pb)
    for x in {x for link in EXTRA_LINKS for x in link if isinstance(x, str)}:
        snap[x] = pos[x]

    print(f"Red peatonal: {len(adj)} puntos · {len(ids)} landmarks\n")
    for i in ids:
        d = meters(pos[i], snap[i])
        if d > 30:
            print(f"  ⚠ {i} está a {d:.0f} m del camino más cercano")

    # 1. Candidatos: pares cercanos con un recorrido razonable
    cand = {}  # key → (pts desde key[0] a key[1], largo en m, origen)
    trees = {i: dijkstra(adj, snap[i]) for i in ids}
    for ai, a in enumerate(ids):
        for b in ids[ai + 1:]:
            k = key(a, b)
            if k in NO_LINKS:
                continue
            straight = meters(pos[a], pos[b])
            if straight > MAX_LINK:
                continue
            dist, prev = trees[k[0]]
            if snap[k[1]] in dist:
                pts = [pos[k[0]]] + walk(prev, snap[k[0]], snap[k[1]]) + [pos[k[1]]]
                pts = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
                length = sum(meters(p, q) for p, q in zip(pts, pts[1:]))
                if length <= MAX_WALK and (straight == 0 or length / straight <= MAX_DETOUR):
                    cand[k] = (pts, length, "osm")
                    continue
            if k in {key(*m) for m in MANUAL_LINKS}:
                cand[k] = ([pos[k[0]], pos[k[1]]], straight * 1.3, "manual")

    for m, note in MANUAL_LINKS.items():
        k = key(*m)
        if k not in cand:
            cand[k] = ([pos[k[0]], pos[k[1]]], meters(pos[k[0]], pos[k[1]]) * 1.3, "manual")

    # 2. Del tramo más corto al más largo: X–Y se descarta si ya se puede ir de X a Y
    #    por tramos conservados (pasando por otros landmarks) sin alargar demasiado.
    kept, dropped = {}, {}

    def kept_dist(src):
        g = {}
        for (a, b), (_, length, _) in kept.items():
            g.setdefault(a, {})[b] = length
            g.setdefault(b, {})[a] = length
        g.setdefault(src, {})
        return dijkstra(g, src)

    forced = {key(*f) for f in FORCED_LINKS}
    for k in forced:
        if k in cand:
            kept[k] = cand[k]
        else:
            a, b = k
            kept[k] = ([pos[a], pos[b]], meters(pos[a], pos[b]) * 1.3, "manual")
            print(f"  ⚠ FORCED_LINKS {a} ↔ {b}: sin camino en OSM, queda en línea recta")

    for k, (pts, length, src) in sorted(cand.items(), key=lambda x: x[1][1]):
        if k in forced:
            continue
        a, b = k
        da, prev_a = kept_dist(a)
        db, _ = kept_dist(b)
        via = None
        if da.get(b, math.inf) <= DETOUR_OK * length:
            path = walk(prev_a, a, b)
            via = path[1] if len(path) > 2 else None
        if via is None:
            for z in ids:
                if z in k or point_to_polyline(pos[z], pts) > NEAR:
                    continue
                if da.get(z, math.inf) + db.get(z, math.inf) <= DETOUR_NEAR * length:
                    via = z
                    break
        if via:
            dropped[k] = via
        else:
            kept[k] = (pts, length, src)

    # 3. Reporte
    print("Tramos (vecinos directos):")
    for (a, b), (pts, length, src) in sorted(kept.items(), key=lambda x: x[0]):
        tag = {"osm": "✓", "manual": "·"}[src]
        note = "" if src == "osm" else f"  línea recta ({MANUAL_LINKS.get((a, b)) or MANUAL_LINKS.get((b, a))})"
        print(f"  {tag} {name[a]:<26} ↔ {name[b]:<26} {length:4.0f} m{note}")
    print(f"\nDescartados porque pasan por otro landmark: {len(dropped)}")
    for (a, b), z in sorted(dropped.items()):
        print(f"  {name[a]} ↔ {name[b]}  →  pasa por {name[z]}")

    # Conexo
    seen, stack = {ids[0]}, [ids[0]]
    while stack:
        u = stack.pop()
        for (a, b) in kept:
            for x, y in ((a, b), (b, a)):
                if x == u and y not in seen:
                    seen.add(y)
                    stack.append(y)
    lonely = [i for i in ids if i not in seen]
    if lonely:
        print(f"\n✗ Quedan sin conexión: {', '.join(lonely)}")

    print(f"\n{len(kept)} tramos → {2 * len(kept)} videos (ida y vuelta)")

    # 4. Aristas
    edges = []
    for (a, b), (pts, length, src) in sorted(kept.items()):
        secs = max(5, round(length / WALK_SPEED))
        for x, y, p in ((a, b, pts), (b, a, pts[::-1])):
            e = {"from": x, "to": y, "video": f"videos/{x}__{y}.mp4", "seconds": secs}
            if src == "osm":
                e["path"] = [[round(q[0], 6), round(q[1], 6)] for q in p]
            edges.append(e)
    graph["edges"] = edges

    if dry:
        print("(--dry-run: no se escribió graph.json)")
        return
    write_graph(graph)
    print("✓ graph.json actualizado")


def write_graph(graph):
    """Formato compacto: un nodo / una arista por línea."""
    lines = ['{', '  "nodes": [']
    lines.append(',\n'.join('    ' + json.dumps(n, ensure_ascii=False) for n in graph["nodes"]))
    lines += ['  ],', '  "edges": [']
    lines.append(',\n'.join('    ' + json.dumps(e, ensure_ascii=False, separators=(", ", ": "))
                            for e in graph["edges"]))
    lines += ['  ]', '}', '']
    GRAPH.write_text('\n'.join(lines))


if __name__ == "__main__":
    main()
