import type { AntragSummary } from "@/lib/log-types";

type SummarySource = Pick<
  AntragSummary,
  | "tenantId"
  | "userId"
  | "completed"
  | "cycleDurationSeconds"
  | "eventCount"
  | "backtrackCount"
  | "repeatCount"
>;

export interface ReportSummary {
  uniqueTenants: number;
  uniqueUsers: number;
  uniqueAntraege: number;
  completedAntraege: number;
  openAntraege: number;
  averageCompletedSeconds: number | null;
  transitionEventCount: number;
  backtrackTransitions: number;
  repeatTransitions: number;
}

function safeRound(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildReportSummary(antraege: SummarySource[]): ReportSummary {
  const completedAntraege = antraege.filter((antrag) => antrag.completed);
  const completedDurations = completedAntraege
    .map((antrag) => antrag.cycleDurationSeconds)
    .filter((value): value is number => value != null);

  return {
    uniqueTenants: new Set(antraege.map((antrag) => antrag.tenantId)).size,
    uniqueUsers: new Set(antraege.map((antrag) => `${antrag.tenantId}|${antrag.userId}`)).size,
    uniqueAntraege: antraege.length,
    completedAntraege: completedAntraege.length,
    openAntraege: antraege.length - completedAntraege.length,
    averageCompletedSeconds:
      completedDurations.length > 0
        ? safeRound(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length)
        : null,
    transitionEventCount: antraege.reduce((sum, antrag) => sum + antrag.eventCount, 0),
    backtrackTransitions: antraege.reduce((sum, antrag) => sum + antrag.backtrackCount, 0),
    repeatTransitions: antraege.reduce((sum, antrag) => sum + antrag.repeatCount, 0),
  };
}
