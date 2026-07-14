import type { AntragSummary } from "@/lib/log-types";

export interface DurationChartPoint {
  antragId: string;
  userId: string;
  startedAt: string;
  durationSeconds: number;
  completed: boolean;
  selected: boolean;
}

export interface DurationChartMarker {
  label: string;
  timestamp: string;
  targetIndex: number;
  beforeCount: number;
  afterCount: number;
}

export interface DurationChartWindow {
  points: DurationChartPoint[];
  marker: DurationChartMarker | null;
}

interface DurationChartOptions {
  limit: number;
  selectedAntragId: string | null;
}

interface CalendarDateMarkerOptions {
  day: number;
  label: string;
  month: number;
}

interface DurationChartWindowOptions {
  limit: number;
  marker: DurationChartMarker | null;
}

type DurationSource = Pick<
  AntragSummary,
  "antragId" | "userId" | "startedAt" | "cycleDurationSeconds" | "observedDurationSeconds" | "completed"
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
      completed: antrag.completed,
      selected: antrag.antragId === options.selectedAntragId,
    }));

  if (options.limit > 0 && sortedPoints.length > options.limit) {
    return sortedPoints.slice(-options.limit);
  }

  return sortedPoints;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createUtcCalendarTimestamp(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

export function buildCalendarDateMarker(
  points: DurationChartPoint[],
  options: CalendarDateMarkerOptions,
): DurationChartMarker | null {
  if (!points.length) {
    return null;
  }

  const pointTimes = points.map((point) => new Date(point.startedAt).getTime());
  const firstPointTime = pointTimes[0];
  const lastPointTime = pointTimes[pointTimes.length - 1];
  const candidateYears = [...new Set(points.map((point) => new Date(point.startedAt).getUTCFullYear()))].sort();
  const markerTimestampMs =
    candidateYears
      .map((year) => createUtcCalendarTimestamp(year, options.month, options.day))
      .find((timestampMs) => timestampMs >= firstPointTime && timestampMs <= lastPointTime) ?? null;

  if (markerTimestampMs == null) {
    return null;
  }

  const targetIndex = pointTimes.findIndex((timestampMs) => timestampMs >= markerTimestampMs);

  if (targetIndex < 0) {
    return null;
  }

  return {
    label: options.label,
    timestamp: new Date(markerTimestampMs).toISOString(),
    targetIndex,
    beforeCount: targetIndex,
    afterCount: points.length - targetIndex,
  };
}

export function buildDurationChartWindow(
  points: DurationChartPoint[],
  options: DurationChartWindowOptions,
): DurationChartWindow {
  if (options.limit <= 0 || points.length <= options.limit) {
    return {
      points,
      marker: options.marker,
    };
  }

  if (!options.marker) {
    return {
      points: points.slice(-options.limit),
      marker: null,
    };
  }

  const startIndex = clamp(
    options.marker.targetIndex - Math.floor(options.limit / 2),
    0,
    points.length - options.limit,
  );
  const endIndex = startIndex + options.limit;
  const adjustedMarkerIndex = options.marker.targetIndex - startIndex;

  return {
    points: points.slice(startIndex, endIndex),
    marker:
      adjustedMarkerIndex >= 0 && adjustedMarkerIndex < options.limit
        ? {
            ...options.marker,
            targetIndex: adjustedMarkerIndex,
            beforeCount: adjustedMarkerIndex,
            afterCount: options.limit - adjustedMarkerIndex,
          }
        : null,
  };
}
