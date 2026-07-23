import assert from "node:assert/strict";
import test from "node:test";
import { createTsModuleLoader } from "../helpers/load-ts-module.mjs";

const loader = createTsModuleLoader();
const { createTranscriptMeasurementsLru } = loader.loadModule(
  "src/lib/transcript-virtual/measurementsLru.ts",
);

const item = (key, size) => ({ index: 0, key, start: 0, size, end: size, lane: 0 });

test("save/restore round-trips measurements at the same width", () => {
  const lru = createTranscriptMeasurementsLru();
  const measurements = [item("a", 120), item("b", 300)];
  lru.save("conv-1", 800, measurements);
  assert.equal(lru.restore("conv-1", 800), measurements);
});

test("restore is width-gated and misses unknown conversations", () => {
  const lru = createTranscriptMeasurementsLru();
  lru.save("conv-1", 800, [item("a", 120)]);
  assert.equal(lru.restore("conv-1", 900), null);
  assert.equal(lru.restore("conv-2", 800), null);
});

test("empty snapshots and blank ids are not stored", () => {
  const lru = createTranscriptMeasurementsLru();
  lru.save("conv-1", 800, []);
  lru.save("", 800, [item("a", 120)]);
  lru.save("conv-2", 0, [item("a", 120)]);
  assert.equal(lru.restore("conv-1", 800), null);
  assert.equal(lru.restore("", 800), null);
  assert.equal(lru.restore("conv-2", 0), null);
});

test("capacity evicts the least recently used entry", () => {
  const lru = createTranscriptMeasurementsLru(2);
  lru.save("conv-1", 800, [item("a", 1)]);
  lru.save("conv-2", 800, [item("b", 2)]);
  // Touch conv-1 so conv-2 becomes the eviction candidate.
  assert.ok(lru.restore("conv-1", 800));
  lru.save("conv-3", 800, [item("c", 3)]);
  assert.ok(lru.restore("conv-1", 800));
  assert.equal(lru.restore("conv-2", 800), null);
  assert.ok(lru.restore("conv-3", 800));
});

test("re-saving a conversation replaces its snapshot", () => {
  const lru = createTranscriptMeasurementsLru();
  lru.save("conv-1", 800, [item("a", 1)]);
  const next = [item("a", 2)];
  lru.save("conv-1", 820, next);
  assert.equal(lru.restore("conv-1", 800), null);
  assert.equal(lru.restore("conv-1", 820), next);
});
