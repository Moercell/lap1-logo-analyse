import assert from "node:assert/strict";
import test from "node:test";

import { buildWeeklyActivity } from "./report-weekly-activity.ts";

function createAntrag(antragId, startedAt) {
  return {
    antragId,
    startedAt,
  };
}

test("buildWeeklyActivity maps processes into weekday and hour cells", () => {
  const activity = buildWeeklyActivity(
    [
      createAntrag("monday-1", "2026-07-06T08:15:00.000Z"),
      createAntrag("monday-2", "2026-07-13T08:45:00.000Z"),
      createAntrag("sunday-1", "2026-07-12T21:10:00.000Z"),
    ],
    {
      timeZone: "UTC",
    },
  );

  const mondayEight = activity.rows[8].cells[0];
  const sundayTwentyOne = activity.rows[21].cells[6];

  assert.equal(activity.totalCount, 3);
  assert.equal(activity.maxCellCount, 2);
  assert.equal(mondayEight.count, 2);
  assert.deepEqual(mondayEight.antragIds, ["monday-1", "monday-2"]);
  assert.equal(mondayEight.intensity, 1);
  assert.equal(sundayTwentyOne.count, 1);
  assert.equal(sundayTwentyOne.intensity, 0.5);
});

test("buildWeeklyActivity keeps all hours and weekdays even without activity", () => {
  const activity = buildWeeklyActivity([], {
    timeZone: "UTC",
  });

  assert.equal(activity.days.length, 7);
  assert.equal(activity.rows.length, 24);
  assert.equal(activity.rows[0].cells.length, 7);
  assert.equal(activity.totalCount, 0);
  assert.equal(activity.maxCellCount, 0);
});
