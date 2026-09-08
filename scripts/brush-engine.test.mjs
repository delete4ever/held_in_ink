import test from "node:test";
import assert from "node:assert/strict";
import {
  characterStartMode,
  creditedTraceDistance,
  createTaperSamples,
  hasHardwarePressure,
  interpolateStrokeSegment,
  isCharacterTraceComplete,
  modelBrushSample,
  seededNoise
} from "../public/brush-engine.js";

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

test("one long touch stroke cannot complete a form prematurely", () => {
  assert.equal(isCharacterTraceComplete({
    distance: 56,
    strokes: 1,
    bounds: { minX: 20, maxX: 45, minY: 20, maxY: 66 },
    fontSize: 104,
    targetWidth: 112,
    targetHeight: 116,
    pointerType: "touch",
    coverageRatio: 0.82,
    onGuideRatio: 0.9
  }), false);
});

test("two deliberate touch strokes can complete a compact form", () => {
  assert.equal(isCharacterTraceComplete({
    distance: 56,
    strokes: 2,
    bounds: { minX: 20, maxX: 45, minY: 20, maxY: 66 },
    fontSize: 104,
    targetWidth: 112,
    targetHeight: 116,
    pointerType: "touch",
    coverageRatio: 0.7,
    onGuideRatio: 0.78
  }), true);
});

test("a tap or tiny scribble cannot complete a form", () => {
  assert.equal(isCharacterTraceComplete({
    distance: 24,
    strokes: 3,
    bounds: { minX: 30, maxX: 38, minY: 30, maxY: 39 },
    fontSize: 104,
    targetWidth: 72,
    targetHeight: 100,
    pointerType: "touch",
    coverageRatio: 0.2,
    onGuideRatio: 0.3
  }), false);
});

test("two broad strokes away from the guide do not complete a form", () => {
  assert.equal(isCharacterTraceComplete({
    distance: 110,
    strokes: 2,
    bounds: { minX: 8, maxX: 100, minY: 8, maxY: 108 },
    fontSize: 104,
    targetWidth: 112,
    targetHeight: 116,
    pointerType: "touch",
    coverageRatio: 0.28,
    onGuideRatio: 0.36
  }), false);
});

test("sparse touch events receive useful but bounded distance credit", () => {
  const credited = creditedTraceDistance({ distance: 90, fontSize: 104, insideSamples: 3 });
  assert.ok(credited > 50);
  assert.ok(credited < 90);
  assert.ok(creditedTraceDistance({ distance: 90, fontSize: 104, insideSamples: 1 }) < credited);
});

test("guided writing blocks future forms but permits revisions to completed forms", () => {
  assert.equal(characterStartMode({ guided: true, hitIndex: 1, expectedIndex: 0 }), "blocked");
  assert.equal(characterStartMode({ guided: true, hitIndex: 0, expectedIndex: 0 }), "expected");
  assert.equal(characterStartMode({ guided: true, hitIndex: 0, expectedIndex: 1, hitCompleted: true }), "revision");
  assert.equal(characterStartMode({ guided: false, hitIndex: null, expectedIndex: null }), "open");
});
