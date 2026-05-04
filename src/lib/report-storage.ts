import type { AnalysisReport } from "@/lib/log-types";

export const REPORT_SNAPSHOT_VERSION = 1;

const REPORT_STORAGE_PREFIX = "lap1-report-snapshot:";
const REPORT_DB_NAME = "lap1-report-snapshots";
const REPORT_STORE_NAME = "snapshots";

export interface ReportSnapshot {
  version: typeof REPORT_SNAPSHOT_VERSION;
  createdAt: string;
  report: AnalysisReport;
  selectedAntragId: string | null;
  searchText: string;
  userFilter: string;
  conclusionText: string;
}

export interface ReportSnapshotInput {
  report: AnalysisReport;
  selectedAntragId: string | null;
  searchText: string;
  userFilter: string;
  conclusionText: string;
}

export interface ReportSnapshotStore {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<unknown> | unknown;
}

function createSnapshotId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSnapshotKey(snapshotId: string): string {
  return `${REPORT_STORAGE_PREFIX}${snapshotId}`;
}

function openReportDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(REPORT_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(REPORT_STORE_NAME)) {
        database.createObjectStore(REPORT_STORE_NAME);
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getDefaultStore(): Promise<ReportSnapshotStore> {
  const database = await openReportDatabase();

  return {
    getItem(key: string) {
      return new Promise<string | null>((resolve, reject) => {
        const transaction = database.transaction(REPORT_STORE_NAME, "readonly");
        const store = transaction.objectStore(REPORT_STORE_NAME);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
      });
    },
    setItem(key: string, value: string) {
      return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(REPORT_STORE_NAME, "readwrite");
        const store = transaction.objectStore(REPORT_STORE_NAME);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },
  };
}

function isReportSnapshot(value: unknown): value is ReportSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<ReportSnapshot>;

  return snapshot.version === REPORT_SNAPSHOT_VERSION && !!snapshot.report && typeof snapshot.createdAt === "string";
}

export function buildReportSnapshot(input: ReportSnapshotInput): ReportSnapshot {
  return {
    version: REPORT_SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    report: input.report,
    selectedAntragId: input.selectedAntragId,
    searchText: input.searchText,
    userFilter: input.userFilter,
    conclusionText: input.conclusionText,
  };
}

export async function saveReportSnapshot(snapshot: ReportSnapshot, storage?: ReportSnapshotStore): Promise<string> {
  const snapshotId = createSnapshotId();
  const nextStorage = storage ?? (await getDefaultStore());

  await nextStorage.setItem(getSnapshotKey(snapshotId), JSON.stringify(snapshot));

  return snapshotId;
}

export async function loadReportSnapshot(snapshotId: string, storage?: ReportSnapshotStore): Promise<ReportSnapshot | null> {
  const nextStorage = storage ?? (await getDefaultStore());
  const rawSnapshot = await nextStorage.getItem(getSnapshotKey(snapshotId));

  if (!rawSnapshot) {
    return null;
  }

  try {
    const snapshot = JSON.parse(rawSnapshot) as unknown;

    return isReportSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

export function updateStoredConclusionText(
  snapshotId: string,
  conclusionText: string,
  storage?: ReportSnapshotStore,
): Promise<void> {
  return updateStoredConclusion(snapshotId, conclusionText, storage);
}

async function updateStoredConclusion(
  snapshotId: string,
  conclusionText: string,
  storage?: ReportSnapshotStore,
): Promise<void> {
  const nextStorage = storage ?? (await getDefaultStore());
  const snapshot = await loadReportSnapshot(snapshotId, nextStorage);

  if (!snapshot) {
    return;
  }

  await nextStorage.setItem(
    getSnapshotKey(snapshotId),
    JSON.stringify({
      ...snapshot,
      conclusionText,
    }),
  );
}
