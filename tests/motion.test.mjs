import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGpsPath } from '../js/mock-gps.js';
import { createMotionDetector, readMotionFix } from '../js/motion.js';
import { createPlayer } from '../js/player.js';
import { distanceMeters } from '../js/route.js';

const origin = [-33.0352, -71.595];
const fix = (meters, seconds, accuracy = 3) => ({
  lat: origin[0] + meters / 111194.93, lng: origin[1], accuracy, timestamp: seconds * 1000,
});

test('ignora ruido dentro del umbral o de la precisión informada', () => {
  const detector = createMotionDetector();
  for (let i = 0; i < 8; i++) {
    detector.update(fix(i % 2 ? 7 : 0, i, 12));
  }
  assert.equal(detector.update(fix(3, 8, 12)), false);
  assert.equal(readMotionFix({ coords: { latitude: 0, longitude: 0, accuracy: 40 }, timestamp: 0 }), null);
});

test('confirma el movimiento acumulado, pausa con histéresis y vuelve a confirmar al reanudar', () => {
  const detector = createMotionDetector();
  assert.equal(detector.update(fix(0, 0)), null);
  for (let i = 1; i <= 5; i++) assert.equal(detector.update(fix(1.2 * i, i)), null);
  assert.equal(detector.update(fix(7.2, 6)), true);
  assert.equal(detector.update(fix(7.2, 7)), true);
  assert.equal(detector.update(fix(7.2, 12)), false);
  assert.equal(detector.update(fix(13.2, 13)), false);
  assert.equal(detector.update(fix(14.4, 14)), true);
  assert.equal(detector.update(fix(14.4, 13)), true);
  assert.equal(detector.update(fix(14.4, 35)), null);
});

test('una lectura inestable por sí sola no inicia la reproducción', () => {
  const detector = createMotionDetector();
  detector.update(fix(0, 0));
  assert.equal(detector.update(fix(30, 1)), null);
  assert.equal(detector.update(fix(0, 2)), null);
  assert.equal(detector.update(fix(7, 3)), null);
  assert.equal(detector.update(fix(0, 4)), null);
});

test('interpola por distancia, omite puntos duplicados y se detiene al final', () => {
  const corner = [origin[0] + 0.0001, origin[1]];
  const end = [corner[0], corner[1] + 0.0002];
  const path = createGpsPath([origin, corner, corner, end]);
  const first = distanceMeters(...origin, ...corner);
  const sample = path.positionAt(first + (path.length - first) / 2, 123);
  assert.equal(sample.timestamp, 123);
  assert.equal(sample.coords.latitude, corner[0]);
  assert.ok(Math.abs(sample.coords.longitude - (corner[1] + end[1]) / 2) < 1e-10);
  assert.equal(readMotionFix(sample).accuracy, 3);
  assert.equal(path.positionAt(-1).coords.latitude, origin[0]);
  assert.equal(path.positionAt(Infinity).coords.longitude, end[1]);
});

class TestVideo extends EventTarget {
  dataset = {};
  paused = true;
  currentTime = 0;
  loads = 0;

  setAttribute() {}
  removeAttribute(name) { delete this[name]; }
  load() { this.loads++; this.currentTime = 0; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

test('el reproductor conserva posición y alterna clips sin saltarse el control', (context) => {
  const videos = [];
  const container = new EventTarget();
  container.appendChild = (video) => videos.push(video);
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => new TestVideo() };
  context.after(() => { globalThis.document = oldDocument; });
  const player = createPlayer({ container, graph: { nodes: [] } });
  const edges = [{ from: 'a', to: 'b', video: 'ab.mp4' }, { from: 'b', to: 'c', video: 'bc.mp4' }];
  player.play(edges);
  const [first, second] = videos;
  assert.equal(player.isMotionControlled(), false);
  assert.equal(first.paused, false);
  first.currentTime = 2.5;
  const loads = first.loads;

  player.setMotionControl(true);
  assert.equal(first.paused, true);
  container.dispatchEvent(new Event('click'));
  assert.equal(first.paused, true);
  player.setMoving(true);
  assert.equal(first.paused, false);
  assert.equal(first.currentTime, 2.5);
  assert.equal(first.loads, loads);
  player.setMoving(false);
  first.dispatchEvent(new Event('ended'));
  assert.equal(player.index, 1);
  assert.equal(second.paused, true);
  player.setMotionControl(false);
  assert.equal(second.paused, false);

  player.setMotionControl(true);
  player.play(edges.slice(1));
  assert.equal(first.paused, true);
  player.setMoving(true);
  assert.equal(first.paused, false);
  player.stop();
  assert.equal(first.paused, true);
});

test('la cola sincronizada espera la llegada geográfica aunque termine el archivo', (context) => {
  const oldDocument = globalThis.document;
  const videos = [];
  const container = new EventTarget();
  container.appendChild = video => videos.push(video);
  globalThis.document = { createElement: () => new TestVideo() };
  context.after(() => { globalThis.document = oldDocument; });
  let reached = false;
  let arrivals = 0;
  const player = createPlayer({
    container,
    graph: { nodes: [] },
    getRouteProgress: index => ({ distance: 40, covered: reached ? 40 : 5, speed: 2, arrived: reached && index === 0 }),
    onFinish: () => { arrivals++; },
  });
  for (const video of videos) video.duration = 20;
  player.setMotionControl(true);
  player.setMoving(true);
  player.play([{ from: 'a', to: 'b', video: 'ab.mp4' }, { from: 'b', to: 'c', video: 'bc.mp4' }]);
  const [first, second] = videos;
  assert.notEqual(first.playbackRate, 1);
  first.currentTime = 20;
  first.ended = true;
  first.pause();
  first.dispatchEvent(new Event('ended'));
  assert.equal(player.index, 0);
  reached = true;
  player.refreshPace();
  assert.equal(player.index, 1);
  assert.equal(second.paused, false);
  player.setMotionControl(false);
  assert.equal(second.playbackRate, 1);
  second.dispatchEvent(new Event('ended'));
  assert.equal(arrivals, 1);
});

test('dos lecturas de 3,5 km/h confirman una caminata aunque el GPS redondee la posición', () => {
  const detector = createMotionDetector();
  for (const time of [0, 3, 6]) detector.update({ ...fix(0, time, 15), speed: 0 });
  assert.equal(detector.update({ ...fix(1, 7, 15), speed: 3.5 / 3.6 }), false);
  assert.equal(detector.update({ ...fix(2, 8, 15), speed: 3.5 / 3.6 }), true);
  assert.equal(detector.update({ ...fix(2, 9, 15), speed: 0 }), true);
  assert.equal(detector.update({ ...fix(2, 14, 15), speed: 0 }), false);
});

test('la velocidad proyectada confirma pasos pequeños cuando la posición es precisa', () => {
  const detector = createMotionDetector();
  detector.update(fix(0, 0));
  assert.equal(detector.update(fix(1, 1), 1), null);
  assert.equal(detector.update(fix(2, 2), 1), true);
});

test('la vista previa arranca sin movimiento y luego reanuda desde el mismo fotograma', (context) => {
  const oldDocument = globalThis.document;
  const videos = [];
  const container = new EventTarget();
  container.appendChild = video => videos.push(video);
  globalThis.document = { createElement: () => new TestVideo() };
  context.after(() => { globalThis.document = oldDocument; });
  let covered = 0;
  const player = createPlayer({
    container, graph: { nodes: [] },
    getRouteProgress: () => ({ distance: 60, covered, speed: 1.2, arrived: false }),
  });
  for (const video of videos) video.duration = 30;
  player.setMotionControl(true);
  player.play([{ from: 'a', to: 'b', video: 'ab.mp4' }], { preview: 4 });
  const [video] = videos;
  assert.equal(player.isPreviewing(), true);
  assert.equal(video.paused, false);
  assert.equal(video.playbackRate, 1);
  video.currentTime = 4;
  video.dispatchEvent(new Event('timeupdate'));
  assert.equal(player.isPreviewing(), false);
  assert.equal(video.paused, true);
  covered = 1;
  player.setMoving(true);
  assert.equal(video.paused, false);
  assert.equal(video.currentTime, 4);
  assert.ok(video.playbackRate < 1);
  player.stop();
  assert.equal(player.isPreviewing(), false);
});

test('el siguiente tramo ofrece su propia vista previa a 1× aunque el usuario esté detenido', (context) => {
  const oldDocument = globalThis.document;
  const videos = [];
  const container = new EventTarget();
  container.appendChild = video => videos.push(video);
  globalThis.document = { createElement: () => new TestVideo() };
  context.after(() => { globalThis.document = oldDocument; });
  let reachedFirst = false;
  const player = createPlayer({
    container, graph: { nodes: [] },
    getRouteProgress: index => ({
      distance: 60, covered: reachedFirst && index === 0 ? 60 : 0, speed: 0,
      arrived: reachedFirst && index === 0,
    }),
  });
  videos.forEach(video => { video.duration = 30; });
  player.setMotionControl(true);
  player.play([{ from: 'a', to: 'b', video: 'ab.mp4' }, { from: 'b', to: 'c', video: 'bc.mp4' }], { preview: 17 });
  videos[0].currentTime = 17;
  videos[0].dispatchEvent(new Event('timeupdate'));
  reachedFirst = true;
  player.refreshPace();
  assert.equal(player.index, 1);
  assert.equal(player.isPreviewing(), true);
  assert.equal(videos[1].paused, false);
  assert.equal(videos[1].playbackRate, 1);
  videos[1].currentTime = 17;
  videos[1].dispatchEvent(new Event('timeupdate'));
  assert.equal(player.isPreviewing(), false);
  assert.equal(videos[1].paused, true);
});
