export const WEEKDAY_COLUMNS = [
  { key: "monday", label: "Mo" },
  { key: "tuesday", label: "Di" },
  { key: "wednesday", label: "Mi" },
  { key: "thursday", label: "Do" },
  { key: "friday", label: "Fr" },
  { key: "saturday", label: "Sa" },
  { key: "sunday", label: "So" },
] as const;

interface WeeklyActivitySource {
  antragId: string;
  startedAt: string;
}

interface WeeklyActivityOptions {
  timeZone?: string;
}

export interface WeeklyActivityCell {
  dayIndex: number;
  hour: number;
  count: number;
  intensity: number;
  antragIds: string[];
}

export interface WeeklyActivityRow {
  hour: number;
  label: string;
  cells: WeeklyActivityCell[];
}

export interface WeeklyActivity {
  days: typeof WEEKDAY_COLUMNS;
  rows: WeeklyActivityRow[];
  totalCount: number;
  maxCellCount: number;
}

const WEEKDAY_INDEX = new Map([
  ["Mon", 0],
  ["Tue", 1],
  ["Wed", 2],
  ["Thu", 3],
  ["Fri", 4],
  ["Sat", 5],
  ["Sun", 6],
]);

function createEmptyRows(): WeeklyActivityRow[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    cells: WEEKDAY_COLUMNS.map((_, dayIndex) => ({
      dayIndex,
      hour,
      count: 0,
      intensity: 0,
      antragIds: [],
    })),
  }));
}

function getWeekPosition(startedAt: string, timeZone?: string): { dayIndex: number; hour: number } | null {
  const date = new Date(startedAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
    weekday: "short",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const dayIndex = weekday ? WEEKDAY_INDEX.get(weekday) : undefined;

  if (dayIndex == null || !Number.isFinite(hour)) {
    return null;
  }

  return {
    dayIndex,
    hour,
  };
}

export function buildWeeklyActivity(
  antraege: WeeklyActivitySource[],
  options: WeeklyActivityOptions = {},
): WeeklyActivity {
  const rows = createEmptyRows();

  for (const antrag of antraege) {
    const weekPosition = getWeekPosition(antrag.startedAt, options.timeZone);

    if (!weekPosition) {
      continue;
    }

    const cell = rows[weekPosition.hour].cells[weekPosition.dayIndex];

    cell.count += 1;
    cell.antragIds.push(antrag.antragId);
  }

  const allCells = rows.flatMap((row) => row.cells);
  const totalCount = allCells.reduce((sum, cell) => sum + cell.count, 0);
  const maxCellCount = Math.max(...allCells.map((cell) => cell.count), 0);

  if (maxCellCount > 0) {
    for (const cell of allCells) {
      cell.intensity = cell.count / maxCellCount;
    }
  }

  return {
    days: WEEKDAY_COLUMNS,
    rows,
    totalCount,
    maxCellCount,
  };
}
