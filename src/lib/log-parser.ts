import {
  type AnalysisReport,
  type AntragSummary,
  type StepState,
  type StepStat,
  type StepVisit,
  type TransitionEventView,
  type UserSummary,
  STEP_SEQUENCE,
} from "@/lib/log-types";

interface CreateEvent {
  timestampMs: number;
}

interface TransitionEvent {
  antragId: string;
  tenantId: string;
  userId: string;
  sessionKey: string;
  operationCode: string;
  level: string;
  timestampMs: number;
  lineNumber: number;
  currentState: StepState;
  nextState: StepState;
}

interface ParseOptions {
  fileName: string;
  sizeBytes: number;
}

const LINE_PATTERN =
  /^\[([^\]@]+?)\s+@\s+\d+\s+\/\s+\d+\]\s+(\S+)\s+<([^:>]+):PORT:([^>]+)>\s+([A-Z0-9]+)\s+#(\d+)\s+\[PdbWizard\]\s+:\s+(.*)$/u;
const TRANSITION_PATTERN =
  /^ANTRAG (\d+): CURRENT STATE: ([A-ZÄÖÜ]+), NEXT STATE: ([A-ZÄÖÜ]+)$/u;
const CREATE_PATTERN = /^LAP-Wizard-Mode: Vorgang anlegen$/u;
const STEP_INDEX = new Map(STEP_SEQUENCE.map((step, index) => [step, index]));

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const cp1252Decoder = new TextDecoder("windows-1252");

function parseTimestamp(timestamp: string): number {
  return new Date(timestamp.replace(" ", "T")).getTime();
}

function formatTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function safeRound(value: number): number {
  return Math.round(value * 100) / 100;
}

function getStateIndex(step: StepState): number {
  return STEP_INDEX.get(step as (typeof STEP_SEQUENCE)[number]) ?? -1;
}

function decodeBuffer(buffer: ArrayBuffer): { text: string; encoding: string } {
  try {
    return {
      text: utf8Decoder.decode(buffer),
      encoding: "utf-8",
    };
  } catch {
    return {
      text: cp1252Decoder.decode(buffer),
      encoding: "windows-1252",
    };
  }
}

function buildVisits(
  transitions: TransitionEvent[],
  processStartMs: number,
): { visits: StepVisit[]; latestState: StepState; completedAt: string | null; firstCompletedAt: string | null } {
  const visits: StepVisit[] = [];
  let openStep: StepState = transitions[0]?.currentState ?? "UNKNOWN";
  let enteredAtMs = processStartMs;
  let latestState: StepState = openStep;
  let firstCompletedAt: string | null = null;

  for (const transition of transitions) {
    if (openStep !== transition.currentState) {
      openStep = transition.currentState;
      enteredAtMs = transition.timestampMs;
    }

    visits.push({
      step: transition.currentState,
      enteredAt: formatTimestamp(enteredAtMs),
      exitedAt: formatTimestamp(transition.timestampMs),
      durationSeconds: safeRound(Math.max(0, transition.timestampMs - enteredAtMs) / 1000),
      exitTo: transition.nextState,
    });

    openStep = transition.nextState;
    enteredAtMs = transition.timestampMs;
    latestState = transition.nextState;

    if (transition.nextState === "FERTIG" && !firstCompletedAt) {
      firstCompletedAt = formatTimestamp(transition.timestampMs);
    }
  }

  visits.push({
    step: latestState,
    enteredAt: formatTimestamp(enteredAtMs),
    exitedAt: null,
    durationSeconds: null,
    exitTo: null,
  });

  return {
    visits,
    latestState,
    completedAt: latestState === "FERTIG" ? formatTimestamp(enteredAtMs) : null,
    firstCompletedAt,
  };
}

export function analyseLogBuffer(buffer: ArrayBuffer, options: ParseOptions): AnalysisReport {
  const { text, encoding } = decodeBuffer(buffer);
  const rawLines = text.split(/\r?\n/u);
  const tenantIds = new Set<string>();
  const userIds = new Set<string>();
  const antragTransitions = new Map<string, TransitionEvent[]>();
  const createEventsByKey = new Map<string, CreateEvent[]>();
  let parsedLineCount = 0;

  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index];

    if (!rawLine.trim()) {
      continue;
    }

    const lineMatch = rawLine.match(LINE_PATTERN);

    if (!lineMatch) {
      continue;
    }

    parsedLineCount += 1;

    const [, rawTimestamp, level, tenantId, userId, sessionKey, operationCode, message] = lineMatch;
    const timestampMs = parseTimestamp(rawTimestamp.trim());

    tenantIds.add(tenantId);
    userIds.add(userId);

    if (CREATE_PATTERN.test(message)) {
      const key = `${tenantId}|${userId}|${sessionKey}`;
      const createEvents = createEventsByKey.get(key) ?? [];

      createEvents.push({ timestampMs });
      createEventsByKey.set(key, createEvents);
      continue;
    }

    const transitionMatch = message.match(TRANSITION_PATTERN);

    if (!transitionMatch) {
      continue;
    }

    const [, antragId, currentState, nextState] = transitionMatch;
    const transitions = antragTransitions.get(antragId) ?? [];

    transitions.push({
      antragId,
      tenantId,
      userId,
      sessionKey,
      operationCode,
      level,
      timestampMs,
      lineNumber: index + 1,
      currentState,
      nextState,
    });

    antragTransitions.set(antragId, transitions);
  }

  const createPointers = new Map<string, number>();
  const transitionStatsMap = new Map<string, number>();
  const stepStatsMap = new Map<StepState, { visitCount: number; totalDurationSeconds: number; maxDurationSeconds: number }>();
  const sortedAntragIds = [...antragTransitions.keys()].sort((left, right) => {
    const leftEvent = antragTransitions.get(left)?.[0];
    const rightEvent = antragTransitions.get(right)?.[0];

    return (leftEvent?.timestampMs ?? 0) - (rightEvent?.timestampMs ?? 0);
  });

  const antraege: AntragSummary[] = [];
  let matchedCreateEventCount = 0;
  let backtrackTransitions = 0;
  let repeatTransitions = 0;

  for (const antragId of sortedAntragIds) {
    const transitions = (antragTransitions.get(antragId) ?? []).sort((left, right) => {
      if (left.timestampMs === right.timestampMs) {
        return left.lineNumber - right.lineNumber;
      }

      return left.timestampMs - right.timestampMs;
    });

    if (!transitions.length) {
      continue;
    }

    const firstTransition = transitions[0];
    const createKey = `${firstTransition.tenantId}|${firstTransition.userId}|${firstTransition.sessionKey}`;
    const createEvents = createEventsByKey.get(createKey) ?? [];
    const startPointer = createPointers.get(createKey) ?? 0;
    let nextPointer = startPointer;
    let matchedCreateTimestampMs: number | null = null;

    if (firstTransition.currentState === "INFORMATION") {
      while (nextPointer < createEvents.length && createEvents[nextPointer].timestampMs <= firstTransition.timestampMs) {
        matchedCreateTimestampMs = createEvents[nextPointer].timestampMs;
        nextPointer += 1;
      }

      if (matchedCreateTimestampMs && firstTransition.timestampMs - matchedCreateTimestampMs <= 30 * 60 * 1000) {
        matchedCreateEventCount += 1;
      } else {
        matchedCreateTimestampMs = null;
      }
    }

    createPointers.set(createKey, nextPointer);

    let localBacktracks = 0;
    let localRepeats = 0;

    for (const transition of transitions) {
      const transitionLabel = `${transition.currentState} -> ${transition.nextState}`;
      transitionStatsMap.set(transitionLabel, (transitionStatsMap.get(transitionLabel) ?? 0) + 1);

      const currentIndex = getStateIndex(transition.currentState);
      const nextIndex = getStateIndex(transition.nextState);

      if (nextIndex === currentIndex) {
        localRepeats += 1;
        repeatTransitions += 1;
      }

      if (nextIndex > -1 && currentIndex > -1 && nextIndex < currentIndex) {
        localBacktracks += 1;
        backtrackTransitions += 1;
      }
    }

    const startedAtMs = matchedCreateTimestampMs ?? firstTransition.timestampMs;
    const { visits, latestState, completedAt, firstCompletedAt } = buildVisits(transitions, startedAtMs);
    const lastObservedMs = transitions[transitions.length - 1].timestampMs;
    const observedDurationSeconds = safeRound(Math.max(0, lastObservedMs - startedAtMs) / 1000);
    const cycleDurationSeconds = completedAt
      ? safeRound(Math.max(0, new Date(completedAt).getTime() - startedAtMs) / 1000)
      : null;

    for (const visit of visits) {
      if (visit.durationSeconds == null) {
        continue;
      }

      const currentStepStats = stepStatsMap.get(visit.step) ?? {
        visitCount: 0,
        totalDurationSeconds: 0,
        maxDurationSeconds: 0,
      };

      currentStepStats.visitCount += 1;
      currentStepStats.totalDurationSeconds += visit.durationSeconds;
      currentStepStats.maxDurationSeconds = Math.max(currentStepStats.maxDurationSeconds, visit.durationSeconds);
      stepStatsMap.set(visit.step, currentStepStats);
    }

    const transitionViews: TransitionEventView[] = transitions.map((transition) => ({
      lineNumber: transition.lineNumber,
      timestamp: formatTimestamp(transition.timestampMs),
      currentState: transition.currentState,
      nextState: transition.nextState,
      sessionKey: transition.sessionKey,
      operationCode: transition.operationCode,
      level: transition.level,
    }));

    antraege.push({
      antragId,
      userId: firstTransition.userId,
      tenantId: firstTransition.tenantId,
      sessionKey: firstTransition.sessionKey,
      startedAt: formatTimestamp(startedAtMs),
      firstCompletedAt,
      completedAt,
      latestState,
      completed: latestState === "FERTIG",
      eventCount: transitions.length,
      backtrackCount: localBacktracks,
      repeatCount: localRepeats,
      observedDurationSeconds,
      cycleDurationSeconds,
      stepVisits: visits,
      transitions: transitionViews,
    });
  }

  const completedDurations = antraege
    .map((antrag) => antrag.cycleDurationSeconds)
    .filter((value): value is number => value != null);

  const usersMap = new Map<string, AntragSummary[]>();

  for (const antrag of antraege) {
    const userKey = `${antrag.tenantId}|${antrag.userId}`;
    const userAntraege = usersMap.get(userKey) ?? [];
    userAntraege.push(antrag);
    usersMap.set(userKey, userAntraege);
  }

  const users: UserSummary[] = [...usersMap.entries()]
    .map(([userKey, userAntraege]) => {
      const [tenantId, userId] = userKey.split("|");
      const completedAntraege = userAntraege.filter((antrag) => antrag.completed);
      const latestActivityAt = userAntraege
        .map((antrag) => antrag.transitions[antrag.transitions.length - 1]?.timestamp ?? antrag.startedAt)
        .sort()
        .at(-1);
      const averageCompletedSeconds =
        completedAntraege.length > 0
          ? safeRound(
              completedAntraege.reduce((sum, antrag) => sum + (antrag.cycleDurationSeconds ?? 0), 0) /
                completedAntraege.length,
            )
          : null;

      return {
        userId,
        tenantId,
        antragCount: userAntraege.length,
        completedCount: completedAntraege.length,
        completionRate: safeRound((completedAntraege.length / userAntraege.length) * 100),
        averageCompletedSeconds,
        averageTransitionsPerAntrag: safeRound(
          userAntraege.reduce((sum, antrag) => sum + antrag.eventCount, 0) / userAntraege.length,
        ),
        backtrackCount: userAntraege.reduce((sum, antrag) => sum + antrag.backtrackCount, 0),
        latestActivityAt: latestActivityAt ?? userAntraege[0]?.startedAt ?? "",
      };
    })
    .sort((left, right) => {
      if (right.antragCount === left.antragCount) {
        return right.completedCount - left.completedCount;
      }

      return right.antragCount - left.antragCount;
    });

  const stepStats: StepStat[] = [...stepStatsMap.entries()]
    .map(([step, stats]) => ({
      step,
      visitCount: stats.visitCount,
      totalDurationSeconds: safeRound(stats.totalDurationSeconds),
      averageDurationSeconds: safeRound(stats.totalDurationSeconds / stats.visitCount),
      maxDurationSeconds: safeRound(stats.maxDurationSeconds),
    }))
    .sort((left, right) => {
      const leftIndex = getStateIndex(left.step);
      const rightIndex = getStateIndex(right.step);

      if (leftIndex === rightIndex) {
        return right.totalDurationSeconds - left.totalDurationSeconds;
      }

      return leftIndex - rightIndex;
    });

  const transitionStats = [...transitionStatsMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);

  const sortedAntraege = antraege.sort((left, right) => {
    return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
  });

  return {
    meta: {
      fileName: options.fileName,
      sizeBytes: options.sizeBytes,
      lineCount: rawLines.length,
      parsedLineCount,
      transitionEventCount: sortedAntraege.reduce((sum, antrag) => sum + antrag.eventCount, 0),
      createEventCount: [...createEventsByKey.values()].reduce((sum, entries) => sum + entries.length, 0),
      matchedCreateEventCount,
      encoding,
      rangeStartedAt: sortedAntraege.at(-1)?.startedAt ?? null,
      rangeEndedAt:
        sortedAntraege[0]?.transitions[sortedAntraege[0].transitions.length - 1]?.timestamp ??
        sortedAntraege[0]?.startedAt ??
        null,
    },
    overview: {
      uniqueTenants: tenantIds.size,
      uniqueUsers: users.length,
      uniqueAntraege: sortedAntraege.length,
      completedAntraege: sortedAntraege.filter((antrag) => antrag.completed).length,
      openAntraege: sortedAntraege.filter((antrag) => !antrag.completed).length,
      averageCompletedSeconds:
        completedDurations.length > 0
          ? safeRound(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length)
          : null,
      averageTransitionsPerAntrag:
        sortedAntraege.length > 0
          ? safeRound(
              sortedAntraege.reduce((sum, antrag) => sum + antrag.eventCount, 0) / sortedAntraege.length,
            )
          : 0,
      backtrackTransitions,
      repeatTransitions,
    },
    stepStats,
    transitionStats,
    users,
    antraege: sortedAntraege,
  };
}
