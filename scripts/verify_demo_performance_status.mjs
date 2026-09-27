import assert from "node:assert/strict";
import { classifyPerformanceRow, formatCacheState, overallPerformanceStatus } from "../lib/demo-performance-status.ts";

const normal = classifyPerformanceRow({
  screen: "dashboard", statuses: [200, 200, 200], hitCount: 3,
  dbQueryCount: 0, medianMs: 80, cacheReady: true,
});
assert.equal(normal.status, "NORMAL");
assert.equal(formatCacheState(["HIT", "HIT", "HIT"]), "HIT 3/3");

const rewarm = classifyPerformanceRow({
  screen: "dashboard", statuses: [200, 200, 200], hitCount: 2,
  dbQueryCount: null, medianMs: 80, cacheReady: true,
});
assert.equal(rewarm.status, "REWARM");
assert.equal(formatCacheState(["MISS", "HIT", "HIT"]), "MISS 1 / HIT 2");

const httpFailure = classifyPerformanceRow({
  screen: "dashboard", statuses: [200, 503, 200], hitCount: 2,
  dbQueryCount: null, medianMs: 80, cacheReady: true,
});
assert.equal(httpFailure.status, "CHECK");

const slow = classifyPerformanceRow({
  screen: "actions", statuses: [200, 200, 200], hitCount: 3,
  dbQueryCount: 0, medianMs: 2500.01, cacheReady: true,
});
assert.equal(slow.status, "CHECK");
assert.equal(overallPerformanceStatus(["NORMAL", "REWARM", "CHECK"]), "CHECK");

console.log("demo performance status cases PASS: NORMAL / REWARM / CHECK");
