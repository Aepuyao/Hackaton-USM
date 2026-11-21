// UI: mapa (Leaflet), selector A→B, ruta, reproductor e idioma.
// La lógica (Dijkstra y cola de videos) vive en js/route.js y js/player.js.
import { loadGraph, nodesById, route, pathNodes, edgeLatLngs, totalSeconds } from './js/route.js';
import { createPlayer } from './js/player.js';
import { LANGS, initLang, getLang, setLang, onLangChange, t, nodeName, applyStatic } from './js/i18n.js';

const $ = (id) => document.getElementById(id);
const COLORS = { pending: '#2f6fb3', active: '#f28c28', done: '#8a9bb0' };

const els = {
  lang: $('lang'),
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

// ---------- Idioma ----------
initLang();
for (const [code, label] of Object.entries(LANGS)) els.lang.add(new Option(label, code));
els.lang.value = getLang();
els.lang.addEventListener('change', () => setLang(els.lang.value));
applyStatic();

// El mensaje se guarda como función para poder re-traducirlo
let messageText = null;
function showMessage(fn, isError = false) {
  messageText = fn;
  els.message.classList.toggle('error', isError);
  renderMessage();
}
function renderMessage() {
  els.message.textContent = messageText ? messageText() : '';
}

// ---------- F1: mapa base ----------
const map = L.map('map', { zoomControl: true });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  maxNativeZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
map.setView([-33.0352, -71.5950], 17); // por si falla la carga del grafo

let graph;
try {
  graph = await loadGraph('graph.json');
} catch (err) {
  console.error(err);
  showMessage(() => t('loadError'), true);
  throw err;
}
const byId = nodesById(graph);
const nameOf = (id) => nodeName(byId.get(id));

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
  // Contenido como función: se evalúa al mostrarse, así sale en el idioma actual
  marker.bindTooltip(() => nodeName(node), { direction: 'top', offset: [0, -6] });
  marker.bindPopup(() => popupFor(node));
}

// Modo revisión (index.html?revisar): dibuja todos los tramos.
// Azul = recorrido real por caminos de OSM · rojo punteado = línea recta, falta confirmar.
if (new URLSearchParams(location.search).has('revisar')) {
  const seen = new Set();
  for (const e of graph.edges) {
    const key = [e.from, e.to].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const real = Array.isArray(e.path);
    L.polyline(edgeLatLngs(graph, e), {
      color: real ? '#2f6fb3' : '#d93025',
      weight: 4,
      opacity: 0.8,
      dashArray: real ? null : '6 6',
    }).bindTooltip(() => `${nameOf(e.from)} ↔ ${nameOf(e.to)} · ${e.seconds} s`, { sticky: true })
      .addTo(map);
  }
  showMessage(() => 'Modo revisión: azul = camino real · rojo punteado = recto, falta confirmar');
}

// Popup con atajos "Salir de aquí" / "Ir aquí"
function popupFor(node) {
  const div = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = nodeName(node);
  const actions = document.createElement('div');
  actions.className = 'popup-actions';
  for (const [key, select] of [['startHere', els.from], ['goHere', els.to]]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t(key);
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
// Opciones ordenadas alfabéticamente en el idioma actual (se rehacen al cambiar de idioma)
function fillSelects() {
  const sorted = [...graph.nodes].sort((a, b) => nodeName(a).localeCompare(nodeName(b), getLang()));
  for (const select of [els.from, els.to]) {
    const value = select.value;
    const placeholder = select.options[0];
    select.replaceChildren(placeholder, ...sorted.map((n) => new Option(nodeName(n), n.id)));
    select.value = value;
  }
  syncSelects();
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
fillSelects();

// ---------- Reproductor ----------
const player = createPlayer({
  container: els.player,
  overlay: els.overlay,
  graph,
  t,
  nameOf,
  onSegment: highlightSegment,
  onFinish: finishRoute,
});

// ---------- F4 + F5: ruta en el mapa ----------
const routeLayer = L.layerGroup().addTo(map);
let segments = [];   // una polyline por tramo
let hereMarker = null;
let currentEdges = [];
let activeIndex = -1; // tramo en reproducción; currentEdges.length = terminado

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
  const latlngs = edges.flatMap((e) => edgeLatLngs(graph, e));

  // Borde blanco debajo para que la línea se lea sobre cualquier fondo
  L.polyline(latlngs, { color: '#fff', weight: 10, opacity: 0.9 }).addTo(routeLayer);

  segments = edges.map((e) => L.polyline(edgeLatLngs(graph, e), {
    color: COLORS.pending,
    weight: 6,
    lineCap: 'round',
  }).addTo(routeLayer));

  const start = nodes[0];
  const end = nodes[nodes.length - 1];
  L.marker([start.lat, start.lng], { icon: pinIcon('A', 'pin-a'), zIndexOffset: 500 })
    .bindTooltip(() => nodeName(start)).addTo(routeLayer);
  L.marker([end.lat, end.lng], { icon: pinIcon('B', 'pin-b'), zIndexOffset: 500 })
    .bindTooltip(() => nodeName(end)).addTo(routeLayer);

  hereMarker = L.marker([start.lat, start.lng], { icon: hereIcon, zIndexOffset: 1000, interactive: false })
    .addTo(routeLayer);

  map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 19 });
}

function renderSteps() {
  els.steps.replaceChildren(...currentEdges.map((e) => {
    const li = document.createElement('li');
    li.append(`${nameOf(e.from)} → ${nameOf(e.to)} `);
    const secs = document.createElement('span');
    secs.className = 'secs';
    secs.textContent = `(${e.seconds} s)`;
    li.appendChild(secs);
    return li;
  }));
  updateStepClasses();
}

function updateStepClasses() {
  [...els.steps.children].forEach((li, j) => {
    li.classList.toggle('done', j < activeIndex);
    li.classList.toggle('active', j === activeIndex);
  });
}

function highlightSegment(i, edge) {
  activeIndex = i;
  segments.forEach((seg, j) => {
    const state = j < i ? 'done' : j === i ? 'active' : 'pending';
    seg.setStyle({ color: COLORS[state], weight: state === 'active' ? 8 : 6 });
    if (state === 'active') seg.bringToFront();
  });
  updateStepClasses();
  const from = byId.get(edge.from);
  hereMarker?.setLatLng([from.lat, from.lng]);
}

function finishRoute() {
  activeIndex = currentEdges.length;
  segments.forEach((seg) => seg.setStyle({ color: COLORS.done, weight: 6 }));
  updateStepClasses();
  const last = currentEdges[currentEdges.length - 1];
  if (last) {
    const end = byId.get(last.to);
    hereMarker?.setLatLng([end.lat, end.lng]);
    showMessage(() => t('arrived', { name: nodeName(end) }));
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
    currentEdges = [];
    els.steps.replaceChildren();
    showMessage(() => t('noRoute'), true);
    return;
  }

  currentEdges = edges;
  activeIndex = -1;
  const n = edges.length;
  const min = Math.max(1, Math.round(totalSeconds(edges) / 60));
  showMessage(() => t(n === 1 ? 'summaryOne' : 'summaryOther', { n, min }));

  drawRoute(edges);
  renderSteps();
  els.playerEmpty.hidden = true;
  player.play(edges); // dentro del submit: cuenta como gesto del usuario (autoplay en celular)

  // En celular, bajar hasta el video
  if (window.matchMedia('(max-width: 800px)').matches) {
    els.player.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// ---------- Cambio de idioma: re-traducir todo lo visible ----------
onLangChange(() => {
  applyStatic();
  fillSelects();
  renderSteps();
  renderMessage();
  player.refresh();
  map.closePopup();
});
