// UI: mapa (Leaflet), selector A→B, ruta y reproductor.
// La lógica (Dijkstra y cola de videos) vive en js/route.js y js/player.js.
import { loadGraph, nodesById, route, pathNodes, totalSeconds } from './js/route.js';
import { createPlayer } from './js/player.js';

const $ = (id) => document.getElementById(id);
const COLORS = { pending: '#2f6fb3', active: '#f28c28', done: '#8a9bb0' };

const els = {
  form: $('route-form'),
  from: $('from'),
  to: $('to'),
  swap: $('swap'),
  go: $('go'),
  message: $('message'),
  player: $('player'),
  overlay: $('overlay'),
  playerEmpty: $('player-empty'),
  steps: $('steps'),
};

function showMessage(text, isError = false) {
  els.message.textContent = text;
  els.message.classList.toggle('error', isError);
}

// ---------- F1: mapa base ----------
const map = L.map('map', { zoomControl: true });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  maxNativeZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
map.setView([-33.0347, -71.5962], 17); // por si falla la carga del grafo

let graph;
try {
  graph = await loadGraph('graph.json');
} catch (err) {
  console.error(err);
  showMessage('No se pudo cargar graph.json. ¿Abriste la página con un servidor local?', true);
  throw err;
}
const byId = nodesById(graph);

// ---------- F2: nodos desde el JSON ----------
const campusBounds = L.latLngBounds(graph.nodes.map((n) => [n.lat, n.lng]));
map.fitBounds(campusBounds, { padding: [30, 30] });

for (const node of graph.nodes) {
  const marker = L.circleMarker([node.lat, node.lng], {
    radius: 7,
    color: '#fff',
    weight: 2,
    fillColor: '#0b2f5b',
    fillOpacity: 1,
  }).addTo(map);
  marker.bindTooltip(node.name, { direction: 'top', offset: [0, -6] });
  marker.bindPopup(() => popupFor(node));
}

// Popup con atajos "Salir de aquí" / "Ir aquí"
function popupFor(node) {
  const div = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = node.name;
  const actions = document.createElement('div');
  actions.className = 'popup-actions';
  for (const [label, select] of [['Salir de aquí', els.from], ['Ir aquí', els.to]]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      select.value = node.id;
      syncSelects();
      map.closePopup();
    });
    actions.appendChild(btn);
  }
  div.append(title, actions);
  return div;
}

// ---------- F3: selector de origen y destino ----------
const sortedNodes = [...graph.nodes].sort((a, b) => a.name.localeCompare(b.name, 'es'));
for (const select of [els.from, els.to]) {
  for (const n of sortedNodes) select.add(new Option(n.name, n.id));
}

// No permitir A = B: la opción elegida en un select se desactiva en el otro
function syncSelects() {
  for (const [select, other] of [[els.from, els.to], [els.to, els.from]]) {
    for (const opt of select.options) {
      opt.disabled = opt.value !== '' && opt.value === other.value;
    }
  }
  const a = els.from.value;
  const b = els.to.value;
  els.go.disabled = !a || !b || a === b;
}

els.from.addEventListener('change', syncSelects);
els.to.addEventListener('change', syncSelects);
els.swap.addEventListener('click', () => {
  [els.from.value, els.to.value] = [els.to.value, els.from.value];
  syncSelects();
});
syncSelects();

// ---------- Reproductor ----------
const player = createPlayer({
  container: els.player,
  overlay: els.overlay,
  graph,
  onSegment: highlightSegment,
  onFinish: finishRoute,
});

// ---------- F4 + F5: ruta en el mapa ----------
const routeLayer = L.layerGroup().addTo(map);
let segments = [];   // una polyline por tramo
let hereMarker = null;
let currentEdges = [];

const pinIcon = (letter, cls) => L.divIcon({
  className: '',
  html: `<div class="pin ${cls}">${letter}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
const hereIcon = L.divIcon({ className: '', html: '<div class="here"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

function drawRoute(edges) {
  routeLayer.clearLayers();
  segments = [];
  hereMarker = null;

  const nodes = pathNodes(graph, edges);
  const latlngs = nodes.map((n) => [n.lat, n.lng]);

  // Borde blanco debajo para que la línea se lea sobre cualquier fondo
  L.polyline(latlngs, { color: '#fff', weight: 10, opacity: 0.9 }).addTo(routeLayer);

  segments = edges.map((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    return L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
      color: COLORS.pending,
      weight: 6,
      lineCap: 'round',
    }).addTo(routeLayer);
  });

  const start = nodes[0];
  const end = nodes[nodes.length - 1];
  L.marker([start.lat, start.lng], { icon: pinIcon('A', 'pin-a'), zIndexOffset: 500 })
    .bindTooltip(start.name).addTo(routeLayer);
  L.marker([end.lat, end.lng], { icon: pinIcon('B', 'pin-b'), zIndexOffset: 500 })
    .bindTooltip(end.name).addTo(routeLayer);

  hereMarker = L.marker([start.lat, start.lng], { icon: hereIcon, zIndexOffset: 1000, interactive: false })
    .addTo(routeLayer);

  map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 19 });
}

function renderSteps(edges) {
  els.steps.replaceChildren(...edges.map((e) => {
    const li = document.createElement('li');
    li.append(`${byId.get(e.from).name} → ${byId.get(e.to).name} `);
    const secs = document.createElement('span');
    secs.className = 'secs';
    secs.textContent = `(${e.seconds} s)`;
    li.appendChild(secs);
    return li;
  }));
}

function highlightSegment(i, edge) {
  segments.forEach((seg, j) => {
    const state = j < i ? 'done' : j === i ? 'active' : 'pending';
    seg.setStyle({ color: COLORS[state], weight: state === 'active' ? 8 : 6 });
    if (state === 'active') seg.bringToFront();
  });
  [...els.steps.children].forEach((li, j) => {
    li.classList.toggle('done', j < i);
    li.classList.toggle('active', j === i);
  });
  const from = byId.get(edge.from);
  hereMarker?.setLatLng([from.lat, from.lng]);
}

function finishRoute() {
  segments.forEach((seg) => seg.setStyle({ color: COLORS.done, weight: 6 }));
  [...els.steps.children].forEach((li) => { li.classList.add('done'); li.classList.remove('active'); });
  const last = currentEdges[currentEdges.length - 1];
  if (last) {
    const end = byId.get(last.to);
    hereMarker?.setLatLng([end.lat, end.lng]);
    showMessage(`Llegaste a ${end.name}.`);
  }
}

// ---------- "Ir" ----------
els.form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const a = els.from.value;
  const b = els.to.value;
  if (!a || !b || a === b) return;

  const edges = route(graph, a, b);
  if (!edges) {
    player.stop();
    routeLayer.clearLayers();
    els.steps.replaceChildren();
    showMessage('No hay un camino entre esos dos puntos.', true);
    return;
  }

  currentEdges = edges;
  const secs = totalSeconds(edges);
  const min = Math.max(1, Math.round(secs / 60));
  showMessage(`${edges.length} tramo${edges.length > 1 ? 's' : ''} · ~${min} min caminando`);

  drawRoute(edges);
  renderSteps(edges);
  els.playerEmpty.hidden = true;
  player.play(edges); // dentro del submit: cuenta como gesto del usuario (autoplay en celular)

  // En celular, bajar hasta el video
  if (window.matchMedia('(max-width: 800px)').matches) {
    els.player.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
