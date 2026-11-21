#!/usr/bin/env node
// Validador del grafo (L5). Uso: node tools/validate-graph.mjs [graph.json]
// Revisa: esquema, ids, aristas a nodos existentes, archivos de video,
// sentido contrario de cada arista y que el grafo sea conexo.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = resolve(process.argv[2] ?? 'graph.json');
const root = dirname(file);
const problems = [];
const warnings = [];

let graph;
try {
  graph = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`✗ No se pudo leer ${file}: ${err.message}`);
  process.exit(1);
}

const nodes = graph.nodes ?? [];
const edges = graph.edges ?? [];
const ids = new Set();

for (const node of nodes) {
  if (!node.id) problems.push(`Nodo sin id: ${JSON.stringify(node)}`);
  else if (ids.has(node.id)) problems.push(`Id de nodo repetido: ${node.id}`);
  ids.add(node.id);
  if (!node.name) problems.push(`Nodo ${node.id} sin name`);
  if (typeof node.lat !== 'number' || typeof node.lng !== 'number') {
    problems.push(`Nodo ${node.id}: lat/lng deben ser números`);
  }
}

const key = (a, b) => `${a}>${b}`;
const edgeKeys = new Set();

for (const edge of edges) {
  const k = key(edge.from, edge.to);
  if (!ids.has(edge.from)) problems.push(`Arista ${k}: el nodo "${edge.from}" no existe`);
  if (!ids.has(edge.to)) problems.push(`Arista ${k}: el nodo "${edge.to}" no existe`);
  if (edge.from === edge.to) problems.push(`Arista ${k}: origen y destino iguales`);
  if (edgeKeys.has(k)) problems.push(`Arista repetida: ${k}`);
  edgeKeys.add(k);

  if (!(typeof edge.seconds === 'number' && edge.seconds > 0)) {
    problems.push(`Arista ${k}: seconds debe ser un número > 0`);
  }

  if (edge.path !== undefined) {
    const ok = Array.isArray(edge.path) && edge.path.length >= 2 &&
      edge.path.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'number'));
    if (!ok) problems.push(`Arista ${k}: path debe ser una lista de [lat, lng] con al menos 2 puntos`);
  }

  if (!edge.video) {
    problems.push(`Arista ${k}: falta video`);
  } else {
    const path = resolve(root, edge.video);
    if (!existsSync(path)) {
      problems.push(`Arista ${k}: no existe el archivo ${edge.video}`);
    } else {
      const mb = statSync(path).size / 1e6;
      if (mb > 6) warnings.push(`Arista ${k}: ${edge.video} pesa ${mb.toFixed(1)} MB (máx. 6)`);
    }
    const expected = `videos/${edge.from}__${edge.to}.mp4`;
    if (edge.video !== expected) warnings.push(`Arista ${k}: se esperaba el nombre ${expected}`);
  }
}

for (const edge of edges) {
  if (!edgeKeys.has(key(edge.to, edge.from))) {
    problems.push(`Arista ${key(edge.from, edge.to)}: falta el sentido contrario ${key(edge.to, edge.from)}`);
  }
}

// Conexo (dirigido): desde el primer nodo se llega a todos, y todos llegan a él
function reachable(start, forward) {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const u = stack.pop();
    for (const e of edges) {
      const [a, b] = forward ? [e.from, e.to] : [e.to, e.from];
      if (a === u && !seen.has(b)) { seen.add(b); stack.push(b); }
    }
  }
  return seen;
}

if (nodes.length > 0) {
  const start = nodes[0].id;
  const fwd = reachable(start, true);
  const back = reachable(start, false);
  for (const id of ids) {
    if (!fwd.has(id)) problems.push(`No se puede llegar a "${id}" desde "${start}"`);
    else if (!back.has(id)) problems.push(`No se puede volver a "${start}" desde "${id}"`);
  }
} else {
  problems.push('El grafo no tiene nodos');
}

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const p of problems) console.error(`✗ ${p}`);

if (problems.length) {
  console.error(`\n${problems.length} problema(s) en ${nodes.length} nodos / ${edges.length} aristas`);
  process.exit(1);
}
console.log(`✓ Grafo OK: ${nodes.length} nodos, ${edges.length} aristas`);
