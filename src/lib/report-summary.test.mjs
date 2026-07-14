import assert from "node:assert/strict";
import test from "node:test";

import { buildReportSummary } from "./report-summary.ts";

function createAntrag(overrides) {
  return {
    antragId: "1",
    userId: "user-a",
    tenantId: "tenant-a",
    cycleDurationSeconds: null,
    observedDurationSeconds: 10,
    completed: false,
    eventCount: 1,
    backtrackCount: 0,
    repeatCount: 0,
    ...overrides,
  };
}

test("buildReportSummary calculates KPI values from the provided filtered antraege only", () => {
  const summary = buildReportSummary([
    createAntrag({
      antragId: "1",
      completed: true,
      cycleDurationSeconds: 120,
      eventCount: 4,
      backtrackCount: 1,
      repeatCount: 0,
    }),
    createAntrag({
      antragId: "2",
      completed: false,
      observedDurationSeconds: 300,
      eventCount: 3,
      backtrackCount: 0,
      repeatCount: 2,
    }),
  ]);

  assert.equal(summary.uniqueAntraege, 2);
  assert.equal(summary.completedAntraege, 1);
  assert.equal(summary.openAntraege, 1);
  assert.equal(summary.averageCompletedSeconds, 120);
  assert.equal(summary.transitionEventCount, 7);
  assert.equal(summary.uniqueUsers, 1);
  assert.equal(summary.uniqueTenants, 1);
  assert.equal(summary.backtrackTransitions, 1);
  assert.equal(summary.repeatTransitions, 2);
});
