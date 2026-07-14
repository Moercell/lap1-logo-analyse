"use client";

import { useMemo } from "react";

import type { AntragSummary } from "@/lib/log-types";
import { buildWeeklyActivity } from "@/lib/report-weekly-activity";

interface ReportWeeklyActivityProps {
  antraege: AntragSummary[];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

function getCellBackground(intensity: number): string {
  if (intensity <= 0) {
    return "transparent";
  }

  return `rgba(10, 110, 160, ${0.12 + intensity * 0.68})`;
}

export function ReportWeeklyActivity({ antraege }: ReportWeeklyActivityProps) {
  const activity = useMemo(() => buildWeeklyActivity(antraege), [antraege]);

  return (
    <section className="pdf-weekly-activity-section">
      <div className="pdf-section-title">
        <p className="section-kicker">Wochenmuster</p>
        <h2>Erstellzeitpunkte nach Wochentag und Uhrzeit</h2>
      </div>

      <div className="pdf-weekly-activity-meta">
        <article>
          <span>Vorgänge</span>
          <strong>{formatNumber(activity.totalCount)}</strong>
        </article>
        <article>
          <span>Peak-Zelle</span>
          <strong>{formatNumber(activity.maxCellCount)}</strong>
        </article>
      </div>

      <div className="pdf-weekly-grid" style={{ gridTemplateColumns: `44px repeat(${activity.days.length}, 1fr)` }}>
        <div className="pdf-weekly-grid-corner" />
        {activity.days.map((day) => (
          <div className="pdf-weekly-grid-day" key={day.key}>
            {day.label}
          </div>
        ))}

        {activity.rows.map((row) => (
          <div className="pdf-weekly-grid-row" key={row.hour}>
            <div className="pdf-weekly-grid-hour">{row.label}</div>
            {row.cells.map((cell) => (
              <div
                aria-label={`${row.label}, ${activity.days[cell.dayIndex].label}: ${cell.count} Vorgänge`}
                className={cell.count > 0 ? "pdf-weekly-cell has-activity" : "pdf-weekly-cell"}
                key={`${row.hour}-${cell.dayIndex}`}
                style={{ background: getCellBackground(cell.intensity) }}
                title={`${row.label}, ${activity.days[cell.dayIndex].label}: ${cell.count} Vorgänge`}
              >
                {cell.count > 0 ? cell.count : ""}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="pdf-weekly-activity-note">
        Alle sichtbaren Vorgänge werden unabhängig von ihrem echten Kalenderdatum auf eine gemeinsame Woche gelegt. Die
        Farbintensität zeigt, zu welchen Tageszeiten Vorgänge typischerweise starten.
      </p>
    </section>
  );
}
