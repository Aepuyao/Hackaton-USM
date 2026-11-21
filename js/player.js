// Reproductor secuencial de clips (L3 + L4).
//
// Usa dos <video> que se alternan: mientras uno reproduce el tramo actual,
// el otro (oculto) precarga el siguiente. Al terminar un clip se muestra el
// otro de inmediato, así no hay pantallazo negro entre tramos.
// Si un clip falla (archivo faltante, formato), se salta al siguiente.
//
// Uso:
//   const player = createPlayer({ container, overlay, graph, onSegment, onFinish });
//   player.play(edges);   // llamar dentro del click de "Ir" (autoplay en celular)
//   player.stop();

import { nodesById } from './route.js';

export function createPlayer({ container, overlay, graph, onSegment, onFinish } = {}) {
  const byId = nodesById(graph);
  const nameOf = (id) => byId.get(id)?.name ?? id;

  const els = [makeVideo(), makeVideo()];
  els.forEach((v) => container.appendChild(v));

  let queue = [];
  let index = -1;  // tramo que se está mostrando
  let active = 0;  // posición en `els` del video visible

  function makeVideo() {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    v.preload = 'auto';
    v.hidden = true;
    v.className = 'route-video';
    v.addEventListener('ended', () => isCurrent(v) && advance());
    v.addEventListener('error', () => {
      if (!isCurrent(v)) return; // error en el precargado: se revisa al mostrarlo
      console.warn('Clip con error, se salta:', v.currentSrc || v.src);
      advance();
    });
    return v;
  }

  function isCurrent(v) {
    return v === els[active] && Number(v.dataset.seg) === index;
  }

  function load(v, i) {
    v.dataset.seg = String(i);
    if (i < queue.length) {
      v.src = queue[i].video;
    } else {
      v.removeAttribute('src');
    }
    v.load();
  }

  function setOverlay(text) {
    if (overlay) overlay.textContent = text;
  }

  function showCurrent() {
    const v = els[active];
    const e = queue[index];
    v.hidden = false;
    els[1 - active].hidden = true;
    setOverlay(`Tramo ${index + 1}/${queue.length}: ${nameOf(e.from)} → ${nameOf(e.to)}`);
    onSegment?.(index, e);

    if (v.error) {
      console.warn('Clip con error, se salta:', e.video);
      advance();
      return;
    }
    v.play().catch((err) => {
      if (err.name === 'NotSupportedError') advance();
      else if (err.name === 'NotAllowedError') setOverlay('Toca el video para reproducir');
      // AbortError: se cambió de clip antes de empezar, se ignora
    });
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
    setOverlay(last ? `Llegaste a ${nameOf(last.to)}` : '');
    onFinish?.();
  }

  function play(edges) {
    stop();
    queue = edges ?? [];
    if (queue.length === 0) {
      setOverlay('Ya estás en el destino');
      return;
    }
    index = 0;
    active = 0;
    load(els[0], 0);
    load(els[1], 1);
    showCurrent();
  }

  function stop() {
    queue = [];
    index = -1;
    for (const v of els) {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.hidden = true;
    }
    setOverlay('');
  }

  // Si el navegador bloqueó el autoplay, un toque lo reanuda
  container.addEventListener('click', () => {
    const v = els[active];
    if (index >= 0 && index < queue.length && v.paused) v.play().catch(() => {});
  });

  return { play, stop, get index() { return index; } };
}
