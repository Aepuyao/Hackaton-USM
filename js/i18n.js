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
