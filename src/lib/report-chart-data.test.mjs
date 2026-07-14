import assert from "node:assert/strict";
import test from "node:test";

import { buildCalendarDateMarker, buildDurationChartPoints, buildDurationChartWindow } from "./report-chart-data.ts";

function createAntrag(antragId, startedAt, durationSeconds, userId = "user-a") {
  return {
    antragId,
    userId,
    startedAt,
    cycleDurationSeconds: durationSeconds,
    observedDurationSeconds: durationSeconds + 10,
    completed: true,
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
        completed: false,
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

test("buildDurationChartPoints preserves whether a process is completed", () => {
  const points = buildDurationChartPoints(
    [
      {
        antragId: "open",
        userId: "user-a",
        startedAt: "2026-02-06T09:01:00.000Z",
        cycleDurationSeconds: null,
        observedDurationSeconds: 125,
        completed: false,
      },
    ],
    {
      limit: 20,
      selectedAntragId: null,
    },
  );

  assert.equal(points[0].completed, false);
});

test("buildCalendarDateMarker finds the first process at or after the configured calendar date", () => {
  const points = buildDurationChartPoints(
    [
      createAntrag("before", "2026-06-30T20:00:00.000Z", 30),
      createAntrag("after", "2026-07-01T08:00:00.000Z", 60),
      createAntrag("later", "2026-07-02T08:00:00.000Z", 90),
    ],
    {
      limit: 0,
      selectedAntragId: null,
    },
  );
  const marker = buildCalendarDateMarker(points, {
    day: 1,
    label: "Update 01.07.",
    month: 7,
  });

  assert.equal(marker?.targetIndex, 1);
  assert.equal(marker?.beforeCount, 1);
  assert.equal(marker?.afterCount, 2);
  assert.equal(marker?.label, "Update 01.07.");
});

test("buildDurationChartWindow keeps the marker visible when limiting chart points", () => {
  const points = buildDurationChartPoints(
    [
      createAntrag("1", "2026-06-29T08:00:00.000Z", 30),
      createAntrag("2", "2026-06-30T08:00:00.000Z", 40),
      createAntrag("3", "2026-07-01T08:00:00.000Z", 50),
      createAntrag("4", "2026-07-02T08:00:00.000Z", 60),
      createAntrag("5", "2026-07-03T08:00:00.000Z", 70),
    ],
    {
      limit: 0,
      selectedAntragId: null,
    },
  );
  const marker = buildCalendarDateMarker(points, {
    day: 1,
    label: "Update 01.07.",
    month: 7,
  });
  const chartWindow = buildDurationChartWindow(points, {
    limit: 3,
    marker,
  });

  assert.deepEqual(
    chartWindow.points.map((point) => point.antragId),
    ["2", "3", "4"],
  );
  assert.equal(chartWindow.marker?.targetIndex, 1);
  assert.equal(chartWindow.marker?.beforeCount, 1);
  assert.equal(chartWindow.marker?.afterCount, 2);
});
