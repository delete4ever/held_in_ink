const SURFACES = Object.freeze({
  paper: Object.freeze({
    widthScale: 1,
    absorption: 1,
    fibre: 0.62,
    opacity: 1,
    inkReserve: 560
  }),
  fan: Object.freeze({
    widthScale: 0.94,
    absorption: 0.52,
    fibre: 0.28,
    opacity: 1.04,
    inkReserve: 720
  }),
  cloth: Object.freeze({
    widthScale: 1.06,
    absorption: 0.7,
    fibre: 1,
    opacity: 0.9,
    inkReserve: 430
  })
});

export function clamp(value, minimum, maximum) {
  const numericValue = Number.isFinite(value) ? value : minimum;
  return Math.min(maximum, Math.max(minimum, numericValue));
}

export function brushSurface(name) {
  return SURFACES[name] || SURFACES.paper;
}

export function hasHardwarePressure(pointerType, pressure) {
  const safePressure = clamp(pressure, 0, 1);
  if (pointerType === "pen") return safePressure > 0.005;
  if (pointerType === "touch") {
    return safePressure > 0.005 && Math.abs(safePressure - 0.5) > 0.035;
  }
  return false;
}

export function modelBrushSample({
  pointerType = "mouse",
  pressure = 0,
  speed = 0,
  previousForce = null,
  strokeDistance = 0,
  surface = "paper"
} = {}) {
  const safeSpeed = clamp(speed, 0, 4);
  const safePressure = clamp(pressure, 0, 1);
  const usesHardwarePressure = hasHardwarePressure(pointerType, safePressure);
  const velocityForce = 0.24 + 0.58 / (1 + safeSpeed * 1.65);
  const pressureForce = 0.06 + Math.pow(safePressure, 0.72) * 0.94;
  const targetForce = clamp(usesHardwarePressure ? pressureForce : velocityForce, 0.1, 1);
  const response = usesHardwarePressure ? 0.48 : 0.32;
  const force = previousForce === null || !Number.isFinite(previousForce)
    ? targetForce
    : clamp(previousForce + (targetForce - previousForce) * response, 0.1, 1);
  const material = brushSurface(surface);
  const speedNarrowing = usesHardwarePressure ? 1 - Math.min(0.15, safeSpeed * 0.055) : 1;
  const width = clamp(
    (0.72 + 15.1 * Math.pow(force, 1.55)) * material.widthScale * speedNarrowing,
    0.8,
    16.5
  );
  const load = clamp(1 - clamp(strokeDistance, 0, 100000) / material.inkReserve, 0, 1);
  const ink = clamp((0.6 + load * 0.4 - Math.min(0.12, safeSpeed * 0.045)) * material.opacity, 0.48, 1);

  return { force, width, ink, usesHardwarePressure };
}

export function interpolateStrokeSegment(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance < 0.01) return [];
  const averageWidth = Math.max(0.8, (from.width + to.width) / 2);
  const spacing = clamp(averageWidth * 0.2, 0.55, 2.35);
  const steps = Math.min(512, Math.max(1, Math.ceil(distance / spacing)));
  const samples = [];

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    samples.push({
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
      width: from.width + (to.width - from.width) * progress,
      force: from.force + (to.force - from.force) * progress,
      ink: from.ink + (to.ink - from.ink) * progress,
      speed: from.speed + (to.speed - from.speed) * progress,
      tilt: from.tilt + (to.tilt - from.tilt) * progress,
      tiltAngle: from.tiltAngle + (to.tiltAngle - from.tiltAngle) * progress
    });
  }

  return samples;
}

export function createTaperSamples(point, direction, steps = 7) {
  const magnitude = Math.hypot(direction?.x || 0, direction?.y || 0);
  const unitX = magnitude > 0.001 ? direction.x / magnitude : 0;
  const unitY = magnitude > 0.001 ? direction.y / magnitude : 1;
  const safeSteps = Math.max(2, Math.min(12, Math.round(steps)));
  const tailLength = clamp(point.width * 0.68, 2.2, 8.5);
  const samples = [];

  for (let index = 1; index <= safeSteps; index += 1) {
    const progress = index / safeSteps;
    const taper = Math.pow(1 - progress, 1.62);
    samples.push({
      ...point,
      x: point.x + unitX * tailLength * progress,
      y: point.y + unitY * tailLength * progress,
      width: Math.max(0.32, point.width * taper),
      force: Math.max(0.04, point.force * taper),
      ink: clamp(point.ink * (0.95 - progress * 0.28), 0.38, 1),
      speed: point.speed + progress * 0.18
    });
  }

  return samples;
}

export function seededNoise(seed, index, salt = 0) {
  let value = (Math.trunc(seed) + Math.imul(Math.trunc(index) + 1, 374761393) + Math.imul(Math.trunc(salt) + 1, 668265263)) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 4294967295;
}
