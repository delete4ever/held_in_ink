import test from "node:test";
import assert from "node:assert/strict";
import {
  createTaperSamples,
  hasHardwarePressure,
  interpolateStrokeSegment,
  modelBrushSample,
  seededNoise
} from "../brush-engine.js";

test("pen pressure produces a wider mark", () => {
  const light = modelBrushSample({ pointerType: "pen", pressure: 0.12, speed: 0.4 });
  const heavy = modelBrushSample({ pointerType: "pen", pressure: 0.86, speed: 0.4 });
  assert.equal(light.usesHardwarePressure, true);
  assert.ok(heavy.width > light.width * 2);
});

test("mouse and default touch pressure use the pace fallback", () => {
  assert.equal(hasHardwarePressure("mouse", 0.5), false);
  assert.equal(hasHardwarePressure("touch", 0.5), false);
  const slow = modelBrushSample({ pointerType: "mouse", pressure: 0.5, speed: 0.12 });
  const fast = modelBrushSample({ pointerType: "mouse", pressure: 0.5, speed: 2.4 });
  assert.equal(slow.usesHardwarePressure, false);
  assert.ok(slow.width > fast.width);
});

test("pressure changes are smoothed without leaving the allowed range", () => {
  const first = modelBrushSample({ pointerType: "pen", pressure: 0.1, speed: 0.3 });
  const next = modelBrushSample({ pointerType: "pen", pressure: 1, speed: 0.3, previousForce: first.force });
  assert.ok(next.force > first.force);
  assert.ok(next.force < 1);
  assert.ok(next.width >= 0.8 && next.width <= 16.5);
});

test("segment interpolation closes fast-movement gaps", () => {
  const from = { x: 0, y: 0, width: 4, force: 0.4, ink: 0.9, speed: 0.3, tilt: 0, tiltAngle: 0 };
  const to = { ...from, x: 120, width: 8 };
  const samples = interpolateStrokeSegment(from, to);
  assert.ok(samples.length > 50);
  assert.equal(samples.at(-1).x, 120);
  assert.equal(samples.at(-1).width, 8);
});

test("taper samples finish in a fine, forward-moving tip", () => {
  const point = { x: 10, y: 15, width: 10, force: 0.7, ink: 0.9, speed: 0.2, tilt: 0, tiltAngle: 0 };
  const taper = createTaperSamples(point, { x: 1, y: 0 });
  assert.ok(taper.at(-1).x > point.x);
  assert.ok(taper.at(-1).width < taper[0].width);
  assert.ok(taper.at(-1).width <= 0.32);
});

test("brush texture noise is deterministic", () => {
  assert.equal(seededNoise(17, 4, 2), seededNoise(17, 4, 2));
  assert.notEqual(seededNoise(17, 4, 2), seededNoise(18, 4, 2));
});
