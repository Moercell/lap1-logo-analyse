import type { AntragSummary } from "@/lib/log-types";

export interface DurationChartPoint {
  antragId: string;
  userId: string;
  startedAt: string;
  durationSeconds: number;
  selected: boolean;
}

interface DurationChartOptions {
  limit: number;
  selectedAntragId: string | null;
}

type DurationSource = Pick<
  AntragSummary,
  "antragId" | "userId" | "startedAt" | "cycleDurationSeconds" | "observedDurationSeconds"
>;

export function buildDurationChartPoints(
  antraege: DurationSource[],
  options: DurationChartOptions,
): DurationChartPoint[] {
  const sortedPoints = [...antraege]
    .sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime())
    .map((antrag) => ({
      antragId: antrag.antragId,
      userId: antrag.userId,
      startedAt: antrag.startedAt,
      durationSeconds: antrag.cycleDurationSeconds ?? antrag.observedDurationSeconds,
      selected: antrag.antragId === options.selectedAntragId,
    }));

  if (options.limit > 0 && sortedPoints.length > options.limit) {
    return sortedPoints.slice(-options.limit);
  }

  return sortedPoints;
}
