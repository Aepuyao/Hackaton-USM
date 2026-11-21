// UI: mapa (Leaflet), selector A→B, ruta, reproductor e idioma.
// La lógica (Dijkstra y cola de videos) vive en js/route.js y js/player.js.
import {
  loadGraph, nodesById, route, pathNodes, edgeLatLngs, totalSeconds, nearestNode, distanceMeters,
} from './js/route.js';
import { createPlayer } from './js/player.js';
import { createMotionDetector, FIX_TIMEOUT_MS, readMotionFix } from './js/motion.js';
import { createGpsPath } from './js/mock-gps.js';
import { createRouteProgress } from './js/route-progress.js';
import { LANGS, initLang, getLang, setLang, onLangChange, t, nodeName, pick, applyStatic } from './js/i18n.js';

const $ = (id) => document.getElementById(id);
const COLORS = { pending: '#2f6fb3', active: '#f28c28', done: '#8a9bb0' };
const ME = '__me'; // valor del origen "📍 Mi ubicación"
const mockGps = new URLSearchParams(location.search).get('mockGps') === '1';

// Estado de la ubicación (se llena en la sección "Ubicación del usuario")
let lastFix = null;      // { lat, lng, nearest: { node, meters } } si está cerca del campus
let routeFromMe = null;  // nodo al que se camina primero si la ruta parte desde la ubicación

const els = {
  lang: $('lang'),
  form: $('route-form'),
  from: $('from'),
  to: $('to'),
  swap: $('swap'),
  recordingPicker: $('recording-picker'),
  recording: $('recording'),
  go: $('go'),
  message: $('message'),
  geoMessage: $('geo-message'),
  stairsInfo: $('stairs-info'),
  player: $('player'),
  overlay: $('overlay'),
  playerEmpty: $('player-empty'),
  steps: $('steps'),
  motion: $('motion-control'),
  motionStatus: $('motion-status'),
  motionProgress: $('motion-progress'),
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
const recordedEdges = new Map(graph.edges.filter(edge => edge.recorded).map(edge => [edge.video, edge]));

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
    const extra = select === els.from ? [new Option(`📍 ${t('myLocation')}`, ME)] : [];
    select.replaceChildren(placeholder, ...extra, ...sorted.map((n) => new Option(nodeName(n), n.id)));
    select.value = value;
  }
  if (recordedEdges.size) {
    const choices = [...recordedEdges.values()].map(edge =>
      new Option(`${nameOf(edge.from)} → ${nameOf(edge.to)}`, edge.video));
    els.recording.replaceChildren(new Option(t('recordedPlaceholder'), ''), ...choices);
    els.recordingPicker.hidden = false;
  }
  syncSelects();
}

// No permitir A = B: la opción elegida en un select se desactiva en el otro.
// "Mi ubicación" solo se puede elegir si hay una ubicación cerca del campus.
function syncSelects() {
  for (const [select, other] of [[els.from, els.to], [els.to, els.from]]) {
    for (const opt of select.options) {
      opt.disabled = opt.value === ME
        ? !lastFix
        : opt.value !== '' && opt.value === other.value;
    }
  }
  const a = els.from.value;
  const b = els.to.value;
  els.recording.value = [...recordedEdges.values()].find(edge => edge.from === a && edge.to === b)?.video ?? '';
  els.go.disabled = !a || !b || a === b || (a === ME && !lastFix);
  els.swap.disabled = a === ME; // "Mi ubicación" no puede ser destino
}

els.from.addEventListener('change', syncSelects);
els.to.addEventListener('change', syncSelects);
els.recording.addEventListener('change', () => {
  const edge = recordedEdges.get(els.recording.value);
  if (edge) {
    els.from.value = edge.from;
    els.to.value = edge.to;
  }
  syncSelects();
});
els.swap.addEventListener('click', () => {
  [els.from.value, els.to.value] = [els.to.value, els.from.value];
  syncSelects();
});
fillSelects();

// ---------- Reproductor ----------
let routeProgress = null;
let lastMotionFix = null;
const player = createPlayer({
  container: els.player,
  overlay: els.overlay,
  graph,
  t,
  nameOf,
  onSegment: highlightSegment,
  onFinish: finishRoute,
  getRouteProgress: (index) => routeProgress?.at(index),
});

const motionDetector = createMotionDetector();
let moving = null;
let motionUnavailable = false;
let motionFallback = false;
let fixTimer;
let lastMotionTimestamp = -Infinity;

function renderMotion() {
  const key = motionUnavailable ? 'motionUnavailable'
    : moving === null ? 'motionWaiting'
    : moving && routeProgress && player.index >= 0 && player.index < currentEdges.length && !routeProgress.at(player.index)
      ? 'motionFollowRoute'
    : moving ? 'motionMoving' : 'motionStopped';
  els.motionStatus.hidden = !els.motion.checked;
  els.motionStatus.dataset.state = key;
  const label = t(motionFallback ? 'motionFallback' : key);
  if (els.motionStatus.textContent !== label) els.motionStatus.textContent = label;

  const metrics = els.motion.checked ? routeProgress?.metrics() : null;
  els.motionProgress.hidden = !metrics;
  if (metrics) {
    const meters = new Intl.NumberFormat(getLang(), { maximumFractionDigits: 0 });
    const speed = new Intl.NumberFormat(getLang(), { maximumFractionDigits: 1 });
    els.motionProgress.textContent = t('motionProgress', {
      total: meters.format(metrics.total),
      remaining: meters.format(activeIndex === currentEdges.length ? 0 : metrics.remaining),
      speed: speed.format(metrics.speed * 3.6),
    });
  }
}

function syncMotion() {
  const enabled = els.motion.checked && !motionFallback;
  if (!enabled) player.setMotionControl(false);
  player.setMoving(moving === true);
  if (enabled) player.setMotionControl(true);
  player.refreshPace();
  renderMotion();
}

function resetMotion({ unavailable = false, fallback = false } = {}) {
  motionDetector.reset();
  moving = null;
  motionUnavailable = unavailable;
  motionFallback = fallback;
  lastMotionTimestamp = -Infinity;
  lastMotionFix = null;
  routeProgress?.reset();
  clearTimeout(fixTimer);
  if (!unavailable) fixTimer = setTimeout(expireMotion, FIX_TIMEOUT_MS);
  syncMotion();
}

function expireMotion() {
  resetMotion({ unavailable: true });
}

function updateMotion(position) {
  const fix = readMotionFix(position);
  if (!fix || Date.now() - fix.timestamp >= FIX_TIMEOUT_MS || fix.timestamp <= lastMotionTimestamp) return;
  clearTimeout(fixTimer);
  fixTimer = setTimeout(expireMotion, FIX_TIMEOUT_MS - Math.max(0, Date.now() - fix.timestamp));
  lastMotionTimestamp = fix.timestamp;
  lastMotionFix = fix;
  routeProgress?.update(fix);
  motionUnavailable = false;
  motionFallback = false;
  moving = motionDetector.update(fix);
  syncMotion();
}

els.motion.checked = false;
els.motion.addEventListener('change', syncMotion);

// ---------- F4 + F5: ruta en el mapa ----------
const routeLayer = L.layerGroup().addTo(map);
let segments = [];   // una polyline por tramo
let hereMarker = null;
let currentEdges = [];
let currentWalk = null; // { node, meters } tramo a pie desde la ubicación (sin video)
let activeIndex = -1;   // tramo en reproducción; currentEdges.length = terminado

const pinIcon = (letter, cls) => L.divIcon({
  className: '',
  html: `<div class="pin ${cls}">${letter}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
const hereIcon = L.divIcon({ className: '', html: '<div class="here"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

// `fromHere`: [lat, lng] del usuario si la ruta parte desde su ubicación
// (el tramo a pie lo dibuja la línea guía de la sección de ubicación).
function drawRoute(edges, fromHere = null) {
  routeLayer.clearLayers();
  segments = [];
  hereMarker = null;

  const nodes = pathNodes(graph, edges);
  const latlngs = edges.flatMap((e) => edgeLatLngs(graph, e));
  const bounds = L.latLngBounds(fromHere ? [fromHere, ...latlngs] : latlngs);

  // Borde blanco debajo para que la línea se lea sobre cualquier fondo
  L.polyline(latlngs, { color: '#fff', weight: 10, opacity: 0.9 }).addTo(routeLayer);

  segments = edges.map((e) => L.polyline(edgeLatLngs(graph, e), {
    color: COLORS.pending,
    weight: 6,
    lineCap: 'round',
  }).addTo(routeLayer));

  const start = nodes[0];
  const end = nodes[nodes.length - 1];
  // Desde la ubicación, el punto azul del usuario hace de "A"
  if (!fromHere) {
    L.marker([start.lat, start.lng], { icon: pinIcon('A', 'pin-a'), zIndexOffset: 500 })
      .bindTooltip(() => nodeName(start)).addTo(routeLayer);
  }
  L.marker([end.lat, end.lng], { icon: pinIcon('B', 'pin-b'), zIndexOffset: 500 })
    .bindTooltip(() => nodeName(end)).addTo(routeLayer);

  hereMarker = L.marker([start.lat, start.lng], { icon: hereIcon, zIndexOffset: 1000, interactive: false })
    .addTo(routeLayer);

  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
}

function stepItem(text, detail, cls) {
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.append(`${text} `);
  const span = document.createElement('span');
  span.className = 'secs';
  span.textContent = `(${detail})`;
  li.appendChild(span);
  return li;
}

function renderSteps() {
  const items = [];
  if (currentWalk) {
    items.push(stepItem(
      `📍 ${t('youAreHere')} → ${nodeName(currentWalk.node)}`,
      `~${Math.round(currentWalk.meters)} m · ${t('onFoot')}`,
      'walk',
    ));
  }
  for (const e of currentEdges) {
    const detail = e.stairs ? `${e.seconds} s · 🪜 ${t('stairs')}` : `${e.seconds} s`;
    items.push(stepItem(`${nameOf(e.from)} → ${nameOf(e.to)}`, detail, e.stairs ? 'has-stairs' : ''));
  }
  els.steps.replaceChildren(...items);
  updateStepClasses();
  renderStairs();
}

// Apartado "¿La ruta tiene escaleras?" según el campo `stairs` de cada arista
function renderStairs() {
  const box = els.stairsInfo;
  if (currentEdges.length === 0) {
    box.hidden = true;
    return;
  }
  const n = currentEdges.filter((e) => e.stairs).length;
  box.hidden = false;
  box.classList.toggle('yes', n > 0);
  box.classList.toggle('no', n === 0);
  box.textContent = n > 0
    ? `🪜 ${t('stairsYes', { n, total: currentEdges.length })}`
    : `✓ ${t('stairsNo')}`;
}

function updateStepClasses() {
  const offset = currentWalk ? 1 : 0; // el tramo a pie no entra en el avance de videos
  [...els.steps.children].slice(offset).forEach((li, j) => {
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

  // Desde "Mi ubicación": primero se camina (sin video) al landmark más cercano
  let start = a;
  let walk = null;
  let here = null;
  if (a === ME) {
    if (!lastFix) return;
    walk = { node: lastFix.nearest.node, meters: lastFix.nearest.meters };
    here = [lastFix.lat, lastFix.lng];
    start = walk.node.id;
  }
  routeFromMe = walk ? walk.node : null;
  drawGuide();

  // El landmark más cercano ya es el destino: solo queda el tramo a pie
  if (start === b) {
    player.stop();
    routeLayer.clearLayers();
    currentEdges = [];
    routeProgress = null;
    resetMockPath();
    currentWalk = walk;
    activeIndex = -1;
    renderSteps();
    els.playerEmpty.hidden = false;
    const m = Math.round(walk.meters);
    showMessage(() => t('walkToDest', { m, name: nodeName(walk.node) }));
    map.fitBounds(L.latLngBounds([here, [walk.node.lat, walk.node.lng]]), { padding: [60, 60], maxZoom: 19 });
    return;
  }

  const edges = route(graph, start, b);
  if (!edges) {
    player.stop();
    routeLayer.clearLayers();
    currentEdges = [];
    routeProgress = null;
    resetMockPath();
    currentWalk = null;
    routeFromMe = null;
    drawGuide();
    els.steps.replaceChildren();
    renderStairs();
    showMessage(() => t('noRoute'), true);
    return;
  }

  currentEdges = edges;
  routeProgress = null;
  resetMockPath(here);
  routeProgress = createRouteProgress(edges.map(edge => edgeLatLngs(graph, edge)), { simulated: mockGps });
  if (lastMotionFix) routeProgress.update(lastMotionFix);
  currentWalk = walk;
  activeIndex = -1;
  const n = edges.length + (walk ? 1 : 0);
  const walkSeconds = walk ? (walk.meters * 1.3) / 1.2 : 0; // ~1,2 m/s, con algo de rodeo
  const min = Math.max(1, Math.round((totalSeconds(edges) + walkSeconds) / 60));
  showMessage(() => t(n === 1 ? 'summaryOne' : 'summaryOther', { n, min }));

  drawRoute(edges, here);
  renderSteps();
  els.playerEmpty.hidden = true;
  player.play(edges); // dentro del submit: cuenta como gesto del usuario (autoplay en celular)
  renderMotion();

  // En celular, bajar hasta el video
  if (window.matchMedia('(max-width: 800px)').matches) {
    els.player.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// ---------- Baños (restrooms.json) ----------
// Pines "WC" con foto y descripción. No forman parte del grafo: "Cómo llegar"
// lleva al landmark más cercano al baño.
const wcIcon = L.divIcon({ className: '', html: '<div class="wc-pin">WC</div>', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });

// Etiqueta de una foto: "Piso 1 · Hombres", "Mujeres", "" (baño para todos)
function photoLabel(p) {
  const parts = [];
  if (p.floor != null) parts.push(t('floorN', { n: p.floor }));
  if (p.gender === 'men' || p.gender === 'women') parts.push(t(p.gender));
  return parts.join(' · ');
}

// Fotos con flechas ‹ › si hay más de una; "Foto pendiente" si no hay o no carga
function photoCarousel(photos, alt) {
  const box = document.createElement('div');
  box.className = 'poi-media';

  const noPhoto = () => {
    const d = document.createElement('div');
    d.className = 'poi-nophoto';
    d.textContent = t('photoPending');
    return d;
  };
  if (photos.length === 0) {
    box.appendChild(noPhoto());
    return box;
  }

  let i = 0;
  const frame = document.createElement('div');
  frame.className = 'poi-frame';
  const caption = document.createElement('div');
  caption.className = 'poi-caption';

  function show() {
    const p = photos[i];
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = [alt, photoLabel(p)].filter(Boolean).join(' – ');
    img.addEventListener('error', () => img.replaceWith(noPhoto()));
    frame.replaceChildren(img);
    const label = photoLabel(p);
    const count = photos.length > 1 ? `${i + 1}/${photos.length}` : '';
    caption.textContent = [label, count].filter(Boolean).join('  ·  ');
    caption.hidden = !caption.textContent;
  }

  box.append(frame, caption);
  if (photos.length > 1) {
    for (const [dir, symbol] of [[-1, '‹'], [1, '›']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `poi-nav ${dir < 0 ? 'prev' : 'next'}`;
      btn.textContent = symbol;
      btn.setAttribute('aria-label', symbol);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        i = (i + dir + photos.length) % photos.length;
        show();
      });
      frame.after(btn);
    }
    // Precargar el resto para que el carrusel no parpadee
    photos.slice(1).forEach((p) => { new Image().src = p.src; });
  }
  show();
  return box;
}

function restroomPopup(r) {
  const div = document.createElement('div');
  div.className = 'poi-popup';

  const kind = document.createElement('div');
  kind.className = 'poi-kind';
  kind.textContent = t('restroom');

  const title = document.createElement('h3');
  title.textContent = pick(r.name);

  const media = photoCarousel(r.photos ?? [], pick(r.name));

  const desc = document.createElement('p');
  desc.textContent = pick(r.description);

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'poi-go';
  go.textContent = t('directions');
  go.addEventListener('click', () => {
    // `node` en restrooms.json fuerza el landmark; si no, el más cercano
    const target = byId.get(r.node) ?? nearestNode(graph, r.lat, r.lng)?.node;
    if (!target) return;
    els.to.value = target.id;
    syncSelects();
    map.closePopup();
    // Si ya hay origen, se arma la ruta de inmediato (el clic cuenta como gesto para el video)
    if (!els.go.disabled) els.form.requestSubmit();
    else els.from.focus();
  });

  div.append(kind, title, media, desc, go);
  return div;
}

try {
  const res = await fetch('restrooms.json');
  if (res.ok) {
    const { restrooms = [] } = await res.json();
    for (const r of restrooms) {
      L.marker([r.lat, r.lng], { icon: wcIcon, zIndexOffset: 300, title: pick(r.name) })
        .bindTooltip(() => pick(r.name), { direction: 'top', offset: [0, -14] })
        .bindPopup(() => restroomPopup(r), { maxWidth: 260 })
        .addTo(map);
    }
  }
} catch (err) {
  console.warn('No se pudieron cargar los baños:', err); // la app sigue funcionando sin ellos
}

// ---------- Ubicación del usuario ----------
// Al entrar se pide la ubicación: se marca al usuario, se busca el landmark más
// cercano, se traza una línea directa hasta él y se deja como origen.
const FAR_FROM_CAMPUS = 1500; // m: más lejos que esto no se dibuja la línea
const AT_NODE = 15;           // m: a menos de esto se considera que ya está en el punto

const geoLayer = L.layerGroup().addTo(map);
let userMarker = null;
let accuracyCircle = null;
let guideLine = null;
let geoWatch = null;
let geoCentered = false;   // la vista se centra solo la primera vez (o al tocar 📍)
let autoFrom = null;       // origen puesto automáticamente (se puede pisar al moverse)
let geoText = null;
let mockPath;
let mockOffset = 0;
let mockMoving = false;
let mockSpeed = 2.4;
let mockTimer;
let mockTickAt;

function emitMockPosition() {
  onPosition(mockPath.positionAt(mockOffset, Date.now(), mockMoving ? mockSpeed : 0));
}

function resetMockPath(here = null) {
  if (!mockGps) return;
  const points = currentEdges.length
    ? currentEdges.flatMap(edge => edgeLatLngs(graph, edge))
    : graph.edges.length ? edgeLatLngs(graph, graph.edges[0]) : [[graph.nodes[0].lat, graph.nodes[0].lng]];
  mockPath = createGpsPath(here ? [here, ...points] : points);
  mockOffset = 0;
  mockTickAt = performance.now();
  resetMotion();
  emitMockPosition();
}

function initMockControls() {
  $('mock-gps').hidden = false;
  $('mock-speed').addEventListener('change', (event) => { mockSpeed = Number(event.target.value); });
  function setMockMoving(value) {
    if (value && mockOffset >= mockPath.length) resetMockPath();
    mockMoving = value;
    mockTickAt = performance.now();
    $('mock-move').disabled = value;
    $('mock-stop').disabled = !value;
  }
  $('mock-move').addEventListener('click', () => setMockMoving(true));
  $('mock-stop').addEventListener('click', () => setMockMoving(false));
  resetMockPath();
  mockTimer = setInterval(() => {
    const now = performance.now();
    if (mockMoving) {
      mockOffset = Math.min(mockPath.length, mockOffset + mockSpeed * Math.min(2, (now - mockTickAt) / 1_000));
      if (mockOffset >= mockPath.length) setMockMoving(false);
    }
    mockTickAt = now;
    emitMockPosition();
  }, 1_000);
}

function showGeo(fn) {
  geoText = fn;
  renderGeo();
}
function renderGeo() {
  els.geoMessage.textContent = geoText ? geoText() : '';
}

const userIcon = L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function onPosition(pos) {
  updateMotion(pos);
  const here = [pos.coords.latitude, pos.coords.longitude];
  const nearest = nearestNode(graph, here[0], here[1]);
  if (!nearest) return;
  const { node, meters } = nearest;

  if (!userMarker) {
    accuracyCircle = L.circle(here, {
      radius: pos.coords.accuracy,
      color: '#1a73e8', weight: 1, fillOpacity: 0.1, interactive: false,
    }).addTo(geoLayer);
    userMarker = L.marker(here, { icon: userIcon, zIndexOffset: 2000, keyboard: false })
      .bindTooltip(() => t('youAreHere'))
      .addTo(geoLayer);
  } else {
    userMarker.setLatLng(here);
    accuracyCircle.setLatLng(here).setRadius(pos.coords.accuracy);
  }

  // Lejos del campus: solo avisar, sin línea ni "Mi ubicación" como origen
  if (meters > FAR_FROM_CAMPUS) {
    lastFix = null;
    drawGuide();
    syncSelects();
    const km = meters / 1000;
    showGeo(() => t('geoFar', {
      km: new Intl.NumberFormat(getLang(), { maximumFractionDigits: 1 }).format(km),
    }));
    geoCentered = true;
    return;
  }

  lastFix = { lat: here[0], lng: here[1], nearest };

  // "Mi ubicación" como origen, salvo que el usuario ya haya elegido otro a mano
  if (!els.from.value || els.from.value === autoFrom) {
    els.from.value = ME;
    autoFrom = ME;
  }
  syncSelects();
  const target = drawGuide();

  if (!geoCentered) {
    map.fitBounds(L.latLngBounds([here, target]), { padding: [60, 60], maxZoom: 19 });
    geoCentered = true;
  }
}

// Línea punteada usuario → landmark: el inicio de la ruta activa si salió desde
// "Mi ubicación", o si no el landmark más cercano. Devuelve el [lat, lng] destino.
function drawGuide() {
  if (!lastFix) {
    guideLine?.remove();
    guideLine = null;
    return null;
  }
  const here = [lastFix.lat, lastFix.lng];
  const node = routeFromMe ?? lastFix.nearest.node;
  const target = [node.lat, node.lng];
  if (!guideLine) {
    guideLine = L.polyline([here, target], {
      color: '#1a73e8', weight: 4, opacity: 0.9, dashArray: '2 8', lineCap: 'round', interactive: false,
    }).addTo(geoLayer);
  } else {
    guideLine.setLatLngs([here, target]);
  }

  const meters = distanceMeters(here[0], here[1], node.lat, node.lng);
  const m = Math.round(meters);
  showGeo(() => (meters <= AT_NODE
    ? t('geoAt', { name: nodeName(node) })
    : t('geoNearest', { m, name: nodeName(node) })));
  return target;
}

function onGeoError(err) {
  resetMotion({ unavailable: true, fallback: err.code === 1 });
  // 1 = permiso denegado · 2 = posición no disponible · 3 = tiempo agotado
  if (err.code === 1) showGeo(() => t('geoDenied'));
  else if (!userMarker) showGeo(() => t('geoUnavailable'));
}

function startGeo() {
  if (mockGps) {
    geoCentered = false;
    if (mockTimer === undefined) initMockControls();
    else emitMockPosition();
    return;
  }
  if (!navigator.geolocation) {
    resetMotion({ unavailable: true, fallback: true });
    showGeo(() => t('geoUnsupported'));
    return;
  }
  geoCentered = false;
  resetMotion();
  if (geoWatch !== null) navigator.geolocation.clearWatch(geoWatch);
  try {
    geoWatch = navigator.geolocation.watchPosition(onPosition, onGeoError, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: FIX_TIMEOUT_MS,
    });
  } catch {
    onGeoError({ code: 1 });
  }
}

// Botón 📍 en el mapa: vuelve a pedir la ubicación y centra la vista
const LocateControl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd() {
    const btn = L.DomUtil.create('button', 'locate-btn');
    btn.type = 'button';
    btn.textContent = '📍';
    L.DomEvent.disableClickPropagation(btn);
    L.DomEvent.on(btn, 'click', startGeo);
    this.button = btn;
    this.translate();
    return btn;
  },
  translate() {
    this.button.title = t('myLocation');
    this.button.setAttribute('aria-label', t('myLocation'));
  },
});
const locateControl = new LocateControl().addTo(map);
startGeo();

// ---------- Cambio de idioma: re-traducir todo lo visible ----------
onLangChange(() => {
  applyStatic();
  fillSelects();
  renderSteps();
  renderMessage();
  renderGeo();
  renderMotion();
  locateControl.translate();
  player.refresh();
  map.closePopup();
});
