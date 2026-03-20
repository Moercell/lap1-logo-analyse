export const STEP_SEQUENCE = ["INFORMATION", "WO", "WAS", "WIE", "WER", "FERTIG"] as const;

export type CanonicalStep = (typeof STEP_SEQUENCE)[number];

export type StepState = CanonicalStep | string;

export interface AnalysisMeta {
  fileName: string;
  sizeBytes: number;
  lineCount: number;
  parsedLineCount: number;
  transitionEventCount: number;
  createEventCount: number;
  matchedCreateEventCount: number;
  encoding: string;
  rangeStartedAt: string | null;
  rangeEndedAt: string | null;
}

export interface AnalysisOverview {
  uniqueTenants: number;
  uniqueUsers: number;
  uniqueAntraege: number;
  completedAntraege: number;
  openAntraege: number;
  averageCompletedSeconds: number | null;
  averageTransitionsPerAntrag: number;
  backtrackTransitions: number;
  repeatTransitions: number;
}

export interface StepVisit {
  step: StepState;
  enteredAt: string;
  exitedAt: string | null;
  durationSeconds: number | null;
  exitTo: StepState | null;
}

export interface TransitionEventView {
  lineNumber: number;
  timestamp: string;
  currentState: StepState;
  nextState: StepState;
  sessionKey: string;
  operationCode: string;
  level: string;
}

export interface AntragSummary {
  antragId: string;
  userId: string;
  tenantId: string;
  sessionKey: string;
  startedAt: string;
  firstCompletedAt: string | null;
  completedAt: string | null;
  latestState: StepState;
  completed: boolean;
  eventCount: number;
  backtrackCount: number;
  repeatCount: number;
  observedDurationSeconds: number;
  cycleDurationSeconds: number | null;
  stepVisits: StepVisit[];
  transitions: TransitionEventView[];
}

export interface UserSummary {
  userId: string;
  tenantId: string;
  antragCount: number;
  completedCount: number;
  completionRate: number;
  averageCompletedSeconds: number | null;
  averageTransitionsPerAntrag: number;
  backtrackCount: number;
  latestActivityAt: string;
}

export interface StepStat {
  step: StepState;
  visitCount: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  maxDurationSeconds: number;
}

export interface TransitionStat {
  label: string;
  count: number;
}

export interface AnalysisReport {
  meta: AnalysisMeta;
  overview: AnalysisOverview;
  stepStats: StepStat[];
  transitionStats: TransitionStat[];
  users: UserSummary[];
  antraege: AntragSummary[];
}
