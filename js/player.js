// Reproductor secuencial de clips (L3 + L4).
//
// Usa dos <video> que se alternan: mientras uno reproduce el tramo actual,
// el otro (oculto) precarga el siguiente. Al terminar un clip se muestra el
// otro de inmediato, así no hay pantallazo negro entre tramos.
// Si un clip falla (archivo faltante, formato), se salta al siguiente.
//
// Uso:
//   const player = createPlayer({ container, overlay, graph, onSegment, onFinish, t, nameOf });
//   player.play(edges);   // llamar dentro del click de "Ir" (autoplay en celular)
//   player.stop();
//   player.refresh();     // vuelve a escribir el overlay (p. ej. al cambiar de idioma)
//
// `t(key, params)` y `nameOf(id)` son opcionales (por defecto, textos en español).

import { nodesById } from './route.js';
import { videoPace } from './route-progress.js';

const DEFAULT_TEXTS = {
  segment: 'Tramo {i}/{n}: {from} → {to}',
  arrived: 'Llegaste a {name}.',
  alreadyThere: 'Ya estás en el destino',
  tapToPlay: 'Toca el video para reproducir',
};
const defaultT = (key, params = {}) =>
  (DEFAULT_TEXTS[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));

export function createPlayer({ container, overlay, graph, onSegment, onFinish, onPreviewChange, t = defaultT, nameOf, getRouteProgress } = {}) {
  const byId = nodesById(graph);
  nameOf ??= (id) => byId.get(id)?.name ?? id;
  let overlayText = null; // función que arma el texto actual del overlay

  const els = [makeVideo(), makeVideo()];
  els.forEach((v) => container.appendChild(v));

  let queue = [];
  let index = -1;  // tramo que se está mostrando
  let active = 0;  // posición en `els` del video visible
  let motionControlled = false;
  let moving = false;
  let playAttempt = 0;
  let previewSeconds = 0;
  let previewPerSegment = 0;
  let previewStart = null;
  const failedVideos = new WeakSet();

  function makeVideo() {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    v.preload = 'auto';
    v.hidden = true;
    v.className = 'route-video';
    v.addEventListener('ended', () => {
      if (!isCurrent(v)) return;
      if (previewSeconds) {
        endPreview();
        syncPlayback();
      } else if (!(motionControlled && getRouteProgress)) advance();
    });
    for (const event of ['loadedmetadata', 'timeupdate']) {
      v.addEventListener(event, () => {
        if (isCurrent(v) && (previewSeconds || (motionControlled && getRouteProgress))) syncPlayback();
      });
    }
    v.addEventListener('error', () => {
      if (!isCurrent(v)) return; // error en el precargado: se revisa al mostrarlo
      reportFailure(v);
    });
    return v;
  }

  function isCurrent(v) {
    return index >= 0 && index < queue.length && v === els[active] && Number(v.dataset.seg) === index;
  }

  function load(v, i) {
    failedVideos.delete(v);
    v.dataset.seg = String(i);
    v.playbackRate = 1;
    if (i < queue.length) {
      v.src = queue[i].video;
    } else {
      v.removeAttribute('src');
    }
    v.load();
  }

  // Se guarda una función (no el texto) para poder re-traducirlo con refresh()
  function setOverlay(fn) {
    overlayText = fn;
    refresh();
  }

  function refresh() {
    if (overlay) overlay.textContent = overlayText ? overlayText() : '';
  }

  function showCurrent() {
    const v = els[active];
    const e = queue[index];
    previewStart = null;
    previewSeconds = motionControlled ? previewPerSegment : 0;
    v.hidden = false;
    els[1 - active].hidden = true;
    const i = index + 1;
    const n = queue.length;
    setOverlay(() => t('segment', { i, n, from: nameOf(e.from), to: nameOf(e.to) }));
    onSegment?.(index, e);

    if (v.error) {
      reportFailure(v);
      return;
    }
    syncPlayback();
    if (previewSeconds) onPreviewChange?.();
  }

  function reportFailure(v) {
    if (!failedVideos.has(v)) console.warn('Clip con error:', v.currentSrc || v.src);
    failedVideos.add(v);
    endPreview();
    syncPlayback();
  }

  function endPreview() {
    if (!previewSeconds) return;
    previewSeconds = 0;
    onPreviewChange?.();
  }

  function syncPlayback() {
    const v = els[active];
    if (!isCurrent(v)) return;
    const previewLimit = v.duration < previewSeconds ? v.duration * .8 : previewSeconds;
    if (previewSeconds && v.currentTime >= previewLimit) {
      previewStart = { time: v.currentTime, covered: getRouteProgress?.(index)?.covered };
      endPreview();
    }
    const paced = !previewSeconds && motionControlled && getRouteProgress;
    const progress = paced ? getRouteProgress(index) : null;
    const failed = failedVideos.has(v);
    if (progress?.arrived && (failed || Number.isFinite(v.duration))) {
      v.pause();
      if (!failed && !v.ended) v.currentTime = v.duration;
      advance();
      return;
    }
    if (failed) {
      if (!paced) advance();
      return;
    }
    let pace = paced ? videoPace(progress, v.duration, v.currentTime) : null;
    if (progress && previewStart) {
      previewStart.covered ??= progress.covered;
      pace = videoPace({
        ...progress,
        distance: progress.distance - previewStart.covered,
        covered: Math.max(0, progress.covered - previewStart.covered),
      }, v.duration - previewStart.time, v.currentTime - previewStart.time);
    }
    if ((!previewSeconds && motionControlled && !moving) || (paced && (!pace || pace.hold || v.ended))) {
      playAttempt += 1;
      if (!v.paused) v.pause();
      return;
    }
    if (pace) {
      if (Math.abs(v.playbackRate - pace.rate) >= .01) {
        try {
          v.playbackRate = pace.rate;
        } catch {
          // Algunos navegadores limitan las tasas. El límite de progreso sigue activo.
          v.playbackRate = 1;
        }
      }
    } else {
      v.playbackRate = 1;
      if (v.ended) {
        advance();
        return;
      }
    }
    if (!v.paused) return;
    const attempt = ++playAttempt;
    v.play().catch((err) => {
      if (attempt !== playAttempt || !isCurrent(v)) return;
      if (err.name === 'NotSupportedError') reportFailure(v);
      else if (err.name === 'NotAllowedError') setOverlay(() => t('tapToPlay'));
      // AbortError: se cambió de clip antes de empezar, se ignora
    });
  }

  function setMotionControl(enabled) {
    if (motionControlled === enabled) return;
    motionControlled = enabled;
    if (!enabled) {
      previewStart = null;
      endPreview();
    }
    syncPlayback();
  }

  function setMoving(value) {
    if (moving === value) return;
    moving = value;
    if (motionControlled) syncPlayback();
  }

  function advance() {
    const prev = els[active];
    index += 1;
    if (index >= queue.length) {
      finish();
      return;
    }
    active = 1 - active;
    // Reutilizar el video anterior para precargar el tramo siguiente.
    // Todo ocurre en la misma tarea, así que no alcanza a verse negro.
    prev.pause();
    load(prev, index + 1);
    showCurrent();
  }

  function finish() {
    const last = queue[queue.length - 1];
    setOverlay(last ? () => t('arrived', { name: nameOf(last.to) }) : null);
    onFinish?.();
  }

  function play(edges, { preview = 0 } = {}) {
    stop();
    queue = edges ?? [];
    if (queue.length === 0) {
      setOverlay(() => t('alreadyThere'));
      return;
    }
    index = 0;
    active = 0;
    previewPerSegment = preview;
    load(els[0], 0);
    load(els[1], 1);
    showCurrent();
  }

  function stop() {
    playAttempt += 1;
    queue = [];
    index = -1;
    previewPerSegment = 0;
    previewStart = null;
    endPreview();
    for (const v of els) {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.hidden = true;
    }
    setOverlay(null);
  }

  // Si el navegador bloqueó el autoplay, un toque lo reanuda
  container.addEventListener('click', syncPlayback);

  return {
    play, stop, refresh, setMotionControl, setMoving,
    refreshPace() { if (motionControlled && getRouteProgress) syncPlayback(); },
    isPreviewing: () => previewSeconds > 0,
    isMotionControlled: () => motionControlled,
    get index() { return index; },
  };
}
