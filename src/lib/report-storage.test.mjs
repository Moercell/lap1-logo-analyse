import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReportSnapshot,
  loadReportSnapshot,
  REPORT_SNAPSHOT_VERSION,
  saveReportSnapshot,
  updateStoredConclusionText,
} from "./report-storage.ts";

const report = {
  meta: {
    fileName: "USER_ACTIVITY.log",
    sizeBytes: 1024,
    lineCount: 10,
    parsedLineCount: 8,
    transitionEventCount: 4,
    createEventCount: 2,
    matchedCreateEventCount: 1,
    encoding: "utf-8",
    rangeStartedAt: "2026-02-06T08:00:00.000Z",
    rangeEndedAt: "2026-02-06T09:00:00.000Z",
  },
  overview: {
    uniqueTenants: 1,
    uniqueUsers: 1,
    uniqueAntraege: 1,
    completedAntraege: 1,
    openAntraege: 0,
    averageCompletedSeconds: 120,
    averageTransitionsPerAntrag: 4,
    backtrackTransitions: 0,
    repeatTransitions: 0,
  },
  stepStats: [],
  transitionStats: [],
  users: [],
  antraege: [],
};

test("buildReportSnapshot keeps report, filter context and an editable conclusion", () => {
  const snapshot = buildReportSnapshot({
    report,
    selectedAntragId: "3004446",
    searchText: "moschmid",
    userFilter: "moschmid",
    conclusionText: "Initiale Bewertung",
  });

  assert.equal(snapshot.version, REPORT_SNAPSHOT_VERSION);
  assert.equal(snapshot.report.meta.fileName, "USER_ACTIVITY.log");
  assert.equal(snapshot.selectedAntragId, "3004446");
  assert.equal(snapshot.searchText, "moschmid");
  assert.equal(snapshot.userFilter, "moschmid");
  assert.equal(snapshot.conclusionText, "Initiale Bewertung");
  assert.match(snapshot.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("saveReportSnapshot stores and loads a snapshot by id", async () => {
  const storage = new Map();
  const storageAdapter = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const snapshot = buildReportSnapshot({
    report,
    selectedAntragId: "3004446",
    searchText: "",
    userFilter: "ALL",
    conclusionText: "",
  });

  const snapshotId = await saveReportSnapshot(snapshot, storageAdapter);
  const loadedSnapshot = await loadReportSnapshot(snapshotId, storageAdapter);

  assert.equal(loadedSnapshot?.report.meta.fileName, "USER_ACTIVITY.log");
  assert.equal(loadedSnapshot?.selectedAntragId, "3004446");
});

test("updateStoredConclusionText only changes the manual conclusion", async () => {
  const storage = new Map();
  const storageAdapter = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const snapshot = buildReportSnapshot({
    report,
    selectedAntragId: "3004446",
    searchText: "",
    userFilter: "ALL",
    conclusionText: "",
  });

  const snapshotId = await saveReportSnapshot(snapshot, storageAdapter);

  await updateStoredConclusionText(snapshotId, "Manuelles Fazit", storageAdapter);

  const loadedSnapshot = await loadReportSnapshot(snapshotId, storageAdapter);

  assert.equal(loadedSnapshot?.conclusionText, "Manuelles Fazit");
  assert.equal(loadedSnapshot?.selectedAntragId, "3004446");
});
