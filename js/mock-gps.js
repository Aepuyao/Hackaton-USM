import { measurePolyline } from './route.js';

export function createGpsPath(points) {
  const { segments, length: total } = measurePolyline(points);

  return {
    length: total,
    positionAt(meters, timestamp = Date.now(), speed = null) {
      const offset = Math.max(0, Math.min(total, meters));
      const segment = segments.find(({ start, length }) => offset <= start + length);
      let [latitude, longitude] = points[0];
      if (segment) {
        const fraction = (offset - segment.start) / segment.length;
        latitude = segment.from[0] + fraction * (segment.to[0] - segment.from[0]);
        longitude = segment.from[1] + fraction * (segment.to[1] - segment.from[1]);
      }
      return {
        coords: { latitude, longitude, accuracy: 3, altitude: null, altitudeAccuracy: null, heading: null, speed },
        timestamp,
      };
    },
  };
}
