import assert from "node:assert/strict";
import test from "node:test";

import { buildDurationChartPoints } from "./report-chart-data.ts";

function createAntrag(antragId, startedAt, durationSeconds, userId = "user-a") {
  return {
    antragId,
    userId,
    startedAt,
    cycleDurationSeconds: durationSeconds,
    observedDurationSeconds: durationSeconds + 10,
  };
}

test("buildDurationChartPoints sorts by start time and keeps the latest limited points", () => {
  const points = buildDurationChartPoints(
    [
      createAntrag("3", "2026-02-06T09:03:00.000Z", 90),
      createAntrag("1", "2026-02-06T09:01:00.000Z", 30),
      createAntrag("2", "2026-02-06T09:02:00.000Z", 60),
    ],
    {
      limit: 2,
      selectedAntragId: "3",
    },
  );

  assert.deepEqual(
    points.map((point) => point.antragId),
    ["2", "3"],
  );
  assert.equal(points[1].selected, true);
  assert.equal(points[0].durationSeconds, 60);
});

test("buildDurationChartPoints falls back to observed duration for open processes", () => {
  const points = buildDurationChartPoints(
    [
      {
        antragId: "open",
        userId: "user-a",
        startedAt: "2026-02-06T09:01:00.000Z",
        cycleDurationSeconds: null,
        observedDurationSeconds: 125,
      },
    ],
    {
      limit: 20,
      selectedAntragId: null,
    },
  );

  assert.equal(points[0].durationSeconds, 125);
  assert.equal(points[0].selected, false);
});
