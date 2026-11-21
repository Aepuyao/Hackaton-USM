import { distanceMeters, measurePolyline } from './route.js';
import { FIX_TIMEOUT_MS } from './motion.js';

const MAX_WALK_SPEED = 8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function project(fix, segment) {
  const { from, to, start, length } = segment;
  const longitudeScale = Math.cos(fix.lat * Math.PI / 180);
  const y = to[0] - from[0];
  const x = (to[1] - from[1]) * longitudeScale;
  const along = ((fix.lat - from[0]) * y + (fix.lng - from[1]) * longitudeScale * x) / (x * x + y * y);
  const fraction = clamp(along, 0, 1);
  return {
    meters: start + fraction * length,
    pastEnd: along >= 1,
    offRoute: distanceMeters(fix.lat, fix.lng, from[0] + fraction * y, from[1] + fraction * (to[1] - from[1])),
  };
}

export function createRouteProgress(paths, { simulated = false } = {}) {
  let total = 0;
  const segments = [];
  const legs = paths.map((points, index) => {
    const measured = measurePolyline(points);
    const start = total;
    segments.push(...measured.segments.map((segment, part) => ({
      ...segment,
      start: start + segment.start,
      endOfLeg: part === measured.segments.length - 1 ? index : null,
    })));
    total += measured.length;
    return { start, length: measured.length, end: points.at(-1) };
  });
  let previous = null;
  let latest = null;

  function reset() {
    previous = latest = null;
  }

  function update(fix) {
    if (previous && fix.timestamp <= previous.fix.timestamp) return;
    if (previous && fix.timestamp - previous.fix.timestamp >= FIX_TIMEOUT_MS) reset();
    const elapsed = previous ? (fix.timestamp - previous.fix.timestamp) / 1000 : 0;
    const tolerance = clamp(12 + fix.accuracy, 18, 30);
    // Una vez en la ruta, tolera cinco metros extra antes de declarar una salida.
    const corridor = tolerance + (latest ? 5 : 0);
    let best = null;
    for (const segment of segments) {
      const candidate = project(fix, segment);
      if (candidate.offRoute > corridor) continue;
      // En cruces y curvas, descarta saltos incompatibles con el tiempo transcurrido.
      if (previous && Math.abs(candidate.meters - previous.meters) > MAX_WALK_SPEED * elapsed + Math.max(8, fix.accuracy)) continue;
      if (!best || candidate.offRoute < best.offRoute) best = { ...candidate, endOfLeg: segment.endOfLeg };
    }
    if (!best) {
      latest = null;
      return;
    }

    const delta = previous ? best.meters - previous.meters : 0;
    const rawSpeed = Number.isFinite(fix.speed) && fix.speed >= 0 && fix.speed <= MAX_WALK_SPEED
      ? fix.speed
      : elapsed ? delta / elapsed : 0;
    const forwardSpeed = delta < -0.5 ? 0 : clamp(rawSpeed, 0, MAX_WALK_SPEED);
    const speed = !previous || forwardSpeed === 0 ? forwardSpeed : .6 * forwardSpeed + .4 * previous.speed;
    latest = previous = { ...best, speed, fix };
  }

  function at(index) {
    const leg = legs[index];
    if (!latest || !leg) return null;
    const covered = clamp(latest.meters - leg.start, 0, leg.length);
    const remaining = leg.length - covered;
    const tolerance = simulated ? .15 : Math.min(5, Math.max(1, latest.fix.accuracy / 2));
    const crossedNearby = !simulated && latest.endOfLeg === index && latest.pastEnd;
    const arrived = latest.meters > leg.start + leg.length || crossedNearby ||
      (remaining <= Math.min(tolerance, leg.length / 3) &&
        distanceMeters(latest.fix.lat, latest.fix.lng, ...leg.end) <= tolerance);
    return { distance: leg.length, covered, speed: latest.meters < leg.start - tolerance ? 0 : latest.speed, arrived };
  }

  function metrics() {
    return latest && { total, remaining: total - latest.meters, speed: latest.speed };
  }

  return { update, at, metrics, reset };
}

// La duración completa del clip representa la longitud completa del tramo.
export function videoPace(progress, duration, currentTime) {
  if (!progress || !Number.isFinite(duration) || duration <= 0 || progress.distance <= 0) return null;
  const { covered, distance, speed } = progress;
  const secondsToArrival = (distance - covered) / Math.max(speed, .01);
  const rate = clamp((duration - currentTime) / Math.max(.1, secondsToArrival), .0625, 4);
  // Con clips muy cortos, el mínimo del navegador aún puede adelantarse al GPS.
  const lead = Math.max(.03, duration * speed / distance);
  const limit = Math.min(duration * .98, duration * covered / distance + lead);
  return { rate, hold: speed <= 0 || currentTime >= limit };
}
