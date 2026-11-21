import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouteProgress, videoPace } from '../js/route-progress.js';
import { createGpsPath } from '../js/mock-gps.js';
import { readMotionFix } from '../js/motion.js';
import { distanceMeters } from '../js/route.js';

const start = [-33.0352, -71.595];
const corner = [-33.0350, -71.595];
const turn = [-33.0350, -71.5947];
const end = [-33.0348, -71.5947];
const legs = [[start, corner, turn], [turn, end]];
const firstLength = distanceMeters(...start, ...corner) + distanceMeters(...corner, ...turn);
const total = firstLength + distanceMeters(...turn, ...end);
const mockPath = createGpsPath([start, corner, turn, end]);
const fix = (meters, seconds, speed = null) => readMotionFix(mockPath.positionAt(meters, seconds * 1000, speed));

test('mide la polilínea, detecta velocidad GPS y separa las llegadas por tramo', () => {
  const progress = createRouteProgress(legs, { simulated: true });
  progress.update(fix(0, 0, 0));
  progress.update(fix(4, 2, 2));
  assert.ok(Math.abs(progress.metrics().total - total) < 1e-6);
  assert.ok(Math.abs(progress.metrics().remaining - (total - 4)) < 1e-6);
  assert.equal(progress.at(0).speed, 1.2);
  progress.update(fix(firstLength - .4, 10, 2));
  assert.equal(progress.at(0).arrived, false);
  progress.update(fix(firstLength + 2, 11, 2));
  assert.equal(progress.at(0).arrived, true);
  assert.equal(progress.at(1).arrived, false);
  assert.ok(Math.abs(progress.at(1).covered - 2) < 1e-6);
  progress.update(fix(total, 16, 0));
  assert.equal(progress.at(1).arrived, true);
  assert.equal(progress.metrics().remaining, 0);
});

test('estima la velocidad sin coords.speed y descarta retrocesos y posiciones fuera de ruta', () => {
  const progress = createRouteProgress(legs);
  progress.update(fix(0, 0));
  progress.update(fix(8, 2));
  assert.ok(Math.abs(progress.at(0).speed - 2.4) < 1e-6);
  progress.update(fix(4, 4));
  assert.equal(progress.at(0).speed, 0);
  progress.update({ lat: start[0], lng: -71.58, accuracy: 3, timestamp: 5000 });
  assert.equal(progress.at(0), null);
  progress.reset();
  assert.equal(progress.metrics(), null);
});

test('ajusta la tasa al tiempo restante y espera si el video llega antes que el GPS', () => {
  const progress = { distance: 40, covered: 10, speed: 1.5 };
  assert.deepEqual(videoPace(progress, 20, 5), { rate: .75, hold: false });
  assert.deepEqual(videoPace({ ...progress, speed: 3 }, 20, 5), { rate: 1.5, hold: false });
  assert.equal(videoPace(progress, 20, 8).hold, true);
  assert.equal(videoPace({ ...progress, speed: 0 }, 20, 5).hold, true);
  assert.equal(videoPace(progress, 1, 0).rate, .0625);
  assert.equal(videoPace(progress, Number.NaN, 0), null);
});
