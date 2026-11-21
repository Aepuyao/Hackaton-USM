// Traducciones de la interfaz. Para agregar un idioma: sumarlo a LANGS y a STRINGS.
// Los nombres de los lugares se traducen en graph.json con `names: { en, fr, de }`.

export const LANGS = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch' };
const DEFAULT = 'es';
const STORAGE_KEY = 'usm-nav-lang';

export const STRINGS = {
  es: {
    pageTitle: 'Cómo llegar · Campus Casa Central USM',
    title: 'Cómo llegar',
    language: 'Idioma',
    mapLabel: 'Mapa del campus',
    from: 'Desde',
    to: 'Hasta',
    fromPlaceholder: 'Elige el origen',
    toPlaceholder: 'Elige el destino',
    recordedLegs: 'Tramos grabados',
    recordedPlaceholder: 'Elige una grabación',
    swap: 'Invertir origen y destino',
    go: 'Ir',
    playerEmpty: 'Elige origen y destino y presiona <strong>Ir</strong> para ver el recorrido.',
    segment: 'Tramo {i}/{n}: {from} → {to}',
    arrived: 'Llegaste a {name}.',
    alreadyThere: 'Ya estás en el destino',
    tapToPlay: 'Toca el video para reproducir',
    noRoute: 'No hay un camino entre esos dos puntos.',
    summaryOne: '{n} tramo · ~{min} min caminando',
    summaryOther: '{n} tramos · ~{min} min caminando',
    loadError: 'No se pudo cargar graph.json. ¿Abriste la página con un servidor local?',
    startHere: 'Salir de aquí',
    goHere: 'Ir aquí',
    myLocation: 'Mi ubicación',
    youAreHere: 'Tu ubicación',
    geoNearest: 'Estás a {m} m de {name}. Camina hasta ahí para empezar.',
    geoAt: 'Estás en {name}.',
    geoFar: 'Estás a {km} km del campus. Cuando llegues te mostraremos el punto más cercano.',
    geoDenied: 'No se pudo acceder a tu ubicación. Puedes elegir el origen a mano.',
    geoUnavailable: 'No se pudo obtener tu ubicación.',
    geoUnsupported: 'Tu navegador no permite obtener la ubicación.',
    onFoot: 'a pie, sin video',
    walkToDest: 'Tu destino es el punto más cercano: camina {m} m hasta {name}.',
    motionControl: 'Reproducción automática por movimiento',
    motionMoving: 'Moviendo — reproduciendo',
    motionStopped: 'Detenido — video pausado',
    motionUnavailable: 'Movimiento GPS no disponible. Video pausado.',
    motionFallback: 'Movimiento GPS no disponible. Reproducción normal activa.',
    motionWaiting: 'Esperando lecturas GPS para detectar movimiento.',
    motionFollowRoute: 'Vuelve al recorrido para reanudar el video.',
    motionProgress: '{remaining} m restantes de {total} m · {speed} km/h',
    mockGps: 'GPS simulado',
    mockMove: 'Mover',
    mockStop: 'Detener',
    mockSpeed: 'Velocidad',
    mockSlow: 'Baja',
    mockNormal: 'Normal',
    mockFast: 'Rápida',
  },
  en: {
    pageTitle: 'Find your way · USM Casa Central Campus',
    title: 'Find your way',
    language: 'Language',
    mapLabel: 'Campus map',
    from: 'From',
    to: 'To',
    fromPlaceholder: 'Choose a starting point',
    toPlaceholder: 'Choose a destination',
    recordedLegs: 'Recorded legs',
    recordedPlaceholder: 'Choose a recording',
    swap: 'Swap start and destination',
    go: 'Go',
    playerEmpty: 'Choose a start and a destination, then press <strong>Go</strong> to watch the route.',
    segment: 'Leg {i}/{n}: {from} → {to}',
    arrived: 'You have arrived at {name}.',
    alreadyThere: 'You are already at your destination',
    tapToPlay: 'Tap the video to play',
    noRoute: 'There is no route between these two points.',
    summaryOne: '{n} leg · ~{min} min walk',
    summaryOther: '{n} legs · ~{min} min walk',
    loadError: 'Could not load graph.json. Did you open the page through a local server?',
    startHere: 'Start here',
    goHere: 'Go here',
    myLocation: 'My location',
    youAreHere: 'Your location',
    geoNearest: 'You are {m} m from {name}. Walk there to start.',
    geoAt: 'You are at {name}.',
    geoFar: 'You are {km} km from campus. Once you arrive, we will show you the nearest point.',
    geoDenied: 'Location access was denied. You can choose the starting point manually.',
    geoUnavailable: 'Could not get your location.',
    geoUnsupported: 'Your browser does not support location.',
    onFoot: 'on foot, no video',
    walkToDest: 'Your destination is the nearest point: walk {m} m to {name}.',
    motionControl: 'Automatic playback based on movement',
    motionMoving: 'Moving — playing',
    motionStopped: 'Stopped — video paused',
    motionUnavailable: 'GPS movement detection unavailable. Video paused.',
    motionFallback: 'GPS movement detection unavailable. Normal playback is active.',
    motionWaiting: 'Waiting for GPS readings to detect movement.',
    motionFollowRoute: 'Return to the route to resume the video.',
    motionProgress: '{remaining} m remaining of {total} m · {speed} km/h',
    mockGps: 'Simulated GPS',
    mockMove: 'Move',
    mockStop: 'Stop',
    mockSpeed: 'Speed',
    mockSlow: 'Slow',
    mockNormal: 'Normal',
    mockFast: 'Fast',
  },
  fr: {
    pageTitle: 'Itinéraire · Campus Casa Central USM',
    title: 'Itinéraire',
    language: 'Langue',
    mapLabel: 'Plan du campus',
    from: 'Départ',
    to: 'Arrivée',
    fromPlaceholder: 'Choisissez le départ',
    toPlaceholder: 'Choisissez la destination',
    recordedLegs: 'Tronçons filmés',
    recordedPlaceholder: 'Choisissez une vidéo',
    swap: 'Inverser départ et arrivée',
    go: 'Y aller',
    playerEmpty: 'Choisissez un départ et une destination, puis appuyez sur <strong>Y aller</strong> pour voir le trajet.',
    segment: 'Étape {i}/{n} : {from} → {to}',
    arrived: 'Vous êtes arrivé : {name}.',
    alreadyThere: 'Vous êtes déjà à destination',
    tapToPlay: 'Touchez la vidéo pour la lancer',
    noRoute: "Il n'y a pas de chemin entre ces deux points.",
    summaryOne: '{n} étape · ~{min} min à pied',
    summaryOther: '{n} étapes · ~{min} min à pied',
    loadError: "Impossible de charger graph.json. Avez-vous ouvert la page via un serveur local ?",
    startHere: "Partir d'ici",
    goHere: 'Aller ici',
    myLocation: 'Ma position',
    youAreHere: 'Votre position',
    geoNearest: 'Vous êtes à {m} m de : {name}. Rejoignez ce point pour commencer.',
    geoAt: 'Vous êtes ici : {name}.',
    geoFar: 'Vous êtes à {km} km du campus. À votre arrivée, nous vous indiquerons le point le plus proche.',
    geoDenied: "L'accès à votre position a été refusé. Vous pouvez choisir le départ manuellement.",
    geoUnavailable: "Impossible d'obtenir votre position.",
    geoUnsupported: 'Votre navigateur ne permet pas la géolocalisation.',
    onFoot: 'à pied, sans vidéo',
    walkToDest: "Votre destination est le point le plus proche : marchez {m} m jusqu'à : {name}.",
    motionControl: 'Lecture automatique selon le mouvement',
    motionMoving: 'En mouvement — lecture en cours',
    motionStopped: 'À l’arrêt — vidéo en pause',
    motionUnavailable: 'Détection du mouvement par GPS indisponible. Vidéo en pause.',
    motionFallback: 'Détection du mouvement par GPS indisponible. Lecture normale active.',
    motionWaiting: 'En attente de relevés GPS pour détecter le mouvement.',
    motionFollowRoute: 'Revenez sur le trajet pour reprendre la vidéo.',
    motionProgress: '{remaining} m restants sur {total} m · {speed} km/h',
    mockGps: 'GPS simulé',
    mockMove: 'Avancer',
    mockStop: 'Arrêter',
    mockSpeed: 'Vitesse',
    mockSlow: 'Lente',
    mockNormal: 'Normale',
    mockFast: 'Rapide',
  },
  de: {
    pageTitle: 'Wegbeschreibung · Campus Casa Central USM',
    title: 'Wegbeschreibung',
    language: 'Sprache',
    mapLabel: 'Campusplan',
    from: 'Von',
    to: 'Nach',
    fromPlaceholder: 'Startpunkt wählen',
    toPlaceholder: 'Ziel wählen',
    recordedLegs: 'Aufgezeichnete Abschnitte',
    recordedPlaceholder: 'Aufnahme wählen',
    swap: 'Start und Ziel tauschen',
    go: 'Los',
    playerEmpty: 'Start und Ziel wählen und auf <strong>Los</strong> tippen, um den Weg zu sehen.',
    segment: 'Abschnitt {i}/{n}: {from} → {to}',
    arrived: 'Sie haben {name} erreicht.',
    alreadyThere: 'Sie sind bereits am Ziel',
    tapToPlay: 'Zum Abspielen auf das Video tippen',
    noRoute: 'Zwischen diesen beiden Punkten gibt es keinen Weg.',
    summaryOne: '{n} Abschnitt · ca. {min} Min. zu Fuß',
    summaryOther: '{n} Abschnitte · ca. {min} Min. zu Fuß',
    loadError: 'graph.json konnte nicht geladen werden. Wurde die Seite über einen lokalen Server geöffnet?',
    startHere: 'Hier starten',
    goHere: 'Hierhin',
    myLocation: 'Mein Standort',
    youAreHere: 'Ihr Standort',
    geoNearest: 'Sie sind {m} m von {name} entfernt. Gehen Sie dorthin, um zu starten.',
    geoAt: 'Sie sind hier: {name}.',
    geoFar: 'Sie sind {km} km vom Campus entfernt. Sobald Sie da sind, zeigen wir Ihnen den nächsten Punkt.',
    geoDenied: 'Der Standortzugriff wurde verweigert. Sie können den Startpunkt manuell wählen.',
    geoUnavailable: 'Ihr Standort konnte nicht ermittelt werden.',
    geoUnsupported: 'Ihr Browser unterstützt keine Standortbestimmung.',
    onFoot: 'zu Fuß, ohne Video',
    walkToDest: 'Ihr Ziel ist der nächste Punkt: Gehen Sie {m} m bis {name}.',
    motionControl: 'Automatische Wiedergabe bei Bewegung',
    motionMoving: 'In Bewegung — Wiedergabe läuft',
    motionStopped: 'Stillstand — Video pausiert',
    motionUnavailable: 'GPS-Bewegungserkennung nicht verfügbar. Video pausiert.',
    motionFallback: 'GPS-Bewegungserkennung nicht verfügbar. Normale Wiedergabe aktiv.',
    motionWaiting: 'Warte auf GPS-Daten zur Bewegungserkennung.',
    motionFollowRoute: 'Kehren Sie zur Route zurück, um das Video fortzusetzen.',
    motionProgress: 'Noch {remaining} m von {total} m · {speed} km/h',
    mockGps: 'Simuliertes GPS',
    mockMove: 'Bewegen',
    mockStop: 'Anhalten',
    mockSpeed: 'Geschwindigkeit',
    mockSlow: 'Langsam',
    mockNormal: 'Normal',
    mockFast: 'Schnell',
  },
};

let current = DEFAULT;
const listeners = new Set();

function readSaved() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

/** Elige el idioma inicial: ?lang= en la URL > el guardado > el del navegador > español. */
export function initLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  const browser = (navigator.languages ?? [navigator.language])
    .map((l) => (l ?? '').slice(0, 2).toLowerCase());
  const pick = [fromUrl, readSaved(), ...browser].find((l) => l && l in LANGS);
  current = pick ?? DEFAULT;
  document.documentElement.lang = current;
  return current;
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!(lang in LANGS) || lang === current) return;
  current = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* sin almacenamiento: no pasa nada */ }
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
}

/** Texto traducido. `{param}` se reemplaza con params.param. */
export function t(key, params = {}) {
  const s = STRINGS[current][key] ?? STRINGS[DEFAULT][key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}

/** Nombre de un lugar en el idioma actual (cae al nombre en español). */
export function nodeName(node) {
  return node?.names?.[current] ?? node?.name ?? '';
}

/**
 * Traduce el HTML estático:
 *   data-i18n="key"            → textContent
 *   data-i18n-html="key"       → innerHTML (solo textos propios del diccionario)
 *   data-i18n-attr="attr:key"  → atributos (separados por coma)
 */
export function applyStatic(root = document) {
  document.title = t('pageTitle');
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      el.setAttribute(attr, t(key));
    }
  });
}
