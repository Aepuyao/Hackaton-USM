// Lógica del grafo: carga de graph.json y camino más corto (Dijkstra).
// Peso de cada arista = `seconds` (duración del clip).
// Funciona en el navegador y en Node (para tests y validador).

/** Carga el grafo desde un JSON. */
export async function loadGraph(url = 'graph.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.json();
}

/** Mapa id → nodo. */
export function nodesById(graph) {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

/**
 * Camino más corto de `from` a `to`.
 * Devuelve la lista ordenada de aristas del camino,
 * [] si from === to, o null si no hay camino o algún id no existe.
 */
export function route(graph, from, to) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (!ids.has(from) || !ids.has(to)) return null;
  if (from === to) return [];

  // Lista de adyacencia: id → aristas salientes
  const out = new Map([...ids].map((id) => [id, []]));
  for (const e of graph.edges) out.get(e.from)?.push(e);

  const dist = new Map([...ids].map((id) => [id, Infinity]));
  const prevEdge = new Map();
  const visited = new Set();
  dist.set(from, 0);

  // O(n²): con ~12 nodos no hace falta cola de prioridad
  while (visited.size < ids.size) {
    let u = null;
    for (const id of ids) {
      if (!visited.has(id) && (u === null || dist.get(id) < dist.get(u))) u = id;
    }
    if (u === null || dist.get(u) === Infinity) break;
    if (u === to) break;
    visited.add(u);

    for (const e of out.get(u)) {
      const d = dist.get(u) + e.seconds;
      if (d < dist.get(e.to)) {
        dist.set(e.to, d);
        prevEdge.set(e.to, e);
      }
    }
  }

  if (dist.get(to) === Infinity) return null;

  const path = [];
  for (let id = to; id !== from; id = prevEdge.get(id).from) {
    path.unshift(prevEdge.get(id));
  }
  return path;
}

/** Nodos del camino en orden (para dibujar la polyline): [A, ..., B]. */
export function pathNodes(graph, edges) {
  if (!edges || edges.length === 0) return [];
  const byId = nodesById(graph);
  return [edges[0].from, ...edges.map((e) => e.to)].map((id) => byId.get(id));
}

/**
 * Puntos [lat, lng] por donde se camina un tramo.
 * Usa `edge.path` si existe (recorrido real); si no, la recta entre los nodos.
 */
export function edgeLatLngs(graph, edge) {
  if (Array.isArray(edge.path) && edge.path.length >= 2) return edge.path;
  const byId = nodesById(graph);
  const a = byId.get(edge.from);
  const b = byId.get(edge.to);
  return [[a.lat, a.lng], [b.lat, b.lng]];
}

/** Distancia en metros entre dos puntos (haversine). */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nodo más cercano a (lat, lng): { node, meters }, o null si el grafo no tiene nodos. */
export function nearestNode(graph, lat, lng) {
  let best = null;
  for (const node of graph.nodes) {
    const meters = distanceMeters(lat, lng, node.lat, node.lng);
    if (!best || meters < best.meters) best = { node, meters };
  }
  return best;
}

/** Duración total del camino en segundos. */
export function totalSeconds(edges) {
  return (edges ?? []).reduce((s, e) => s + e.seconds, 0);
}
