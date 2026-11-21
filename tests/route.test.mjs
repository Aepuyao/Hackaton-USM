// Tests de Dijkstra (L2). Correr con: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, pathNodes, totalSeconds, nearestNode, distanceMeters } from '../js/route.js';

const e = (from, to, seconds) => ({ from, to, seconds, video: `videos/${from}__${to}.mp4` });
const n = (id) => ({ id, name: id, lat: 0, lng: 0 });

const graph = {
  nodes: ['a', 'b', 'c', 'd', 'aislado'].map(n),
  edges: [
    e('a', 'b', 10), e('b', 'a', 10),
    e('b', 'c', 10), e('c', 'b', 10),
    e('a', 'c', 50), e('c', 'a', 50), // directo pero más lento
    e('c', 'd', 5), e('d', 'c', 5),
  ],
};

const ids = (edges) => edges.map((x) => `${x.from}>${x.to}`);

test('nodos adyacentes', () => {
  assert.deepEqual(ids(route(graph, 'a', 'b')), ['a>b']);
});

test('nodos lejanos: elige el camino de menor tiempo, no el de menos tramos', () => {
  const r = route(graph, 'a', 'd');
  assert.deepEqual(ids(r), ['a>b', 'b>c', 'c>d']);
  assert.equal(totalSeconds(r), 25);
  assert.deepEqual(pathNodes(graph, r).map((x) => x.id), ['a', 'b', 'c', 'd']);
});

test('respeta la dirección de las aristas', () => {
  const g = { nodes: ['x', 'y'].map(n), edges: [e('x', 'y', 1)] };
  assert.equal(ids(route(g, 'x', 'y')).length, 1);
  assert.equal(route(g, 'y', 'x'), null);
});

test('sin camino → null', () => {
  assert.equal(route(graph, 'a', 'aislado'), null);
});

test('id inexistente → null', () => {
  assert.equal(route(graph, 'a', 'nope'), null);
});

test('distanceMeters: ~111 m por milésima de grado de latitud', () => {
  const d = distanceMeters(-33.035, -71.595, -33.036, -71.595);
  assert.ok(Math.abs(d - 111.2) < 1, `dio ${d}`);
});

test('nearestNode elige el nodo más cercano', () => {
  const g = {
    nodes: [
      { id: 'lejos', name: 'lejos', lat: -33.0400, lng: -71.5950 },
      { id: 'cerca', name: 'cerca', lat: -33.0351, lng: -71.5951 },
    ],
    edges: [],
  };
  const r = nearestNode(g, -33.0350, -71.5950);
  assert.equal(r.node.id, 'cerca');
  assert.ok(r.meters < 20);
  assert.equal(nearestNode({ nodes: [], edges: [] }, 0, 0), null);
});

test('mismo origen y destino → []', () => {
  assert.deepEqual(route(graph, 'a', 'a'), []);
});
