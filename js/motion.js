import { distanceMeters } from './route.js';

export const FIX_TIMEOUT_MS = 20_000;
const MAX_ACCURACY_METERS = 25;
const STOP_DWELL_MS = 6_000;
const CONFIRMATIONS = 2;

export function readMotionFix(position) {
  const { latitude: lat, longitude: lng, accuracy, speed } = position.coords;
  const { timestamp } = position;
  if (![lat, lng, accuracy, timestamp].every(Number.isFinite) ||
      accuracy < 0 || accuracy > MAX_ACCURACY_METERS) return null;
  return { lat, lng, accuracy, timestamp, speed };
}

export function createMotionDetector({ threshold = 5 } = {}) {
  let anchor;
  let previous;
  let confirmations = 0;
  let quietSamples = 0;
  let moving = null;

  function reset() {
    anchor = previous = undefined;
    confirmations = quietSamples = 0;
    moving = null;
  }

  function update(fix) {
    if (previous && fix.timestamp <= previous.timestamp) return moving;
    if (!previous || fix.timestamp - previous.timestamp >= FIX_TIMEOUT_MS) {
      reset();
      anchor = previous = fix;
      return moving;
    }

    const noise = Math.max(threshold, (anchor.accuracy + fix.accuracy) / 2);
    const displacement = distanceMeters(anchor.lat, anchor.lng, fix.lat, fix.lng);
    const step = distanceMeters(previous.lat, previous.lng, fix.lat, fix.lng);
    const elapsed = (fix.timestamp - previous.timestamp) / 1_000;

    // Un salto demasiado rápido para alguien a pie no cuenta como evidencia.
    if (step > 8 * elapsed + noise) {
      confirmations = quietSamples = 0;
      return moving;
    }
    previous = fix;

    // El ancla permite acumular pasos pequeños hasta superar el ruido.
    if (displacement >= noise) {
      quietSamples = 0;
      if (++confirmations >= CONFIRMATIONS) {
        moving = true;
        anchor = fix;
        confirmations = 0;
      }
    } else {
      confirmations = 0;
      if (++quietSamples >= CONFIRMATIONS && fix.timestamp - anchor.timestamp >= STOP_DWELL_MS) {
        moving = false;
      }
    }
    return moving;
  }

  return { update, reset };
}
