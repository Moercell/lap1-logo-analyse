"use client";

import { useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  type ChartData,
  type ChartDataset,
  type ChartOptions,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  type Plugin,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type { AntragSummary } from "@/lib/log-types";
import { buildCalendarDateMarker, buildDurationChartPoints, buildDurationChartWindow } from "@/lib/report-chart-data";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const UPDATE_MARKER_LABEL = "Update 01.07.";
const UPDATE_MARKER_MONTH = 7;
const UPDATE_MARKER_DAY = 1;

interface ReportDurationChartProps {
  antraege: AntragSummary[];
  selectedAntragId: string | null;
}

function formatDuration(seconds: number): string {
  const formatDecimal = (value: number, maximumFractionDigits: number) =>
    new Intl.NumberFormat("de-DE", {
      maximumFractionDigits,
      minimumFractionDigits: maximumFractionDigits,
    }).format(value);

  if (seconds < 60) {
    return `${formatDecimal(seconds, 1)} s`;
  }

  if (seconds < 3600) {
    return `${formatDecimal(seconds / 60, 1)} min`;
  }

  return `${formatDecimal(seconds / 3600, 2)} h`;
}

function formatAxisDuration(value: number | string): string {
  const seconds = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(seconds)) {
    return "";
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)}m`;
  }

  return `${(seconds / 3600).toFixed(1)}h`;
}

export function ReportDurationChart({ antraege, selectedAntragId }: ReportDurationChartProps) {
  const chartView = useMemo(() => {
    const allPoints = buildDurationChartPoints(antraege, {
      limit: 0,
      selectedAntragId,
    });
    const updateMarker = buildCalendarDateMarker(allPoints, {
      day: UPDATE_MARKER_DAY,
      label: UPDATE_MARKER_LABEL,
      month: UPDATE_MARKER_MONTH,
    });

    return buildDurationChartWindow(allPoints, {
      limit: 90,
      marker: updateMarker,
    });
  }, [antraege, selectedAntragId]);
  const points = chartView.points;
  const updateMarker = chartView.marker;
  const selectedPointIndex = points.findIndex((point) => point.selected);
  const selectedPoint = selectedPointIndex > -1 ? points[selectedPointIndex] : null;
  const labels = points.map((_, index) => `${index + 1}`);
  const maxDuration = Math.max(...points.map((point) => point.durationSeconds), 1);
  const averageDuration =
    points.length > 0 ? points.reduce((sum, point) => sum + point.durationSeconds, 0) / points.length : 0;
  const updateMarkerPlugin = useMemo<Plugin<"line">>(
    () => ({
      id: "update-marker",
      afterDraw(chart) {
        if (!updateMarker) {
          return;
        }

        const xScale = chart.scales.x;
        const markerX = xScale.getPixelForValue(updateMarker.targetIndex);
        const { bottom, top } = chart.chartArea;
        const { ctx } = chart;

        ctx.save();
        ctx.strokeStyle = "#b27818";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(markerX, top);
        ctx.lineTo(markerX, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#172d3f";
        ctx.font = "700 11px Open Sans, Segoe UI, sans-serif";
        ctx.textAlign = markerX > chart.width - 120 ? "right" : "left";
        ctx.fillText(updateMarker.label, markerX + (markerX > chart.width - 120 ? -8 : 8), top + 14);
        ctx.restore();
      },
    }),
    [updateMarker],
  );

  const chartData = useMemo<ChartData<"line">>(() => {
    const datasets: ChartDataset<"line">[] = [
      {
        label: "Prozessdauer",
        data: points.map((point) => point.durationSeconds),
        borderColor: "#0a6ea0",
        backgroundColor: "rgba(10, 110, 160, 0.12)",
        borderWidth: 3,
        pointRadius: 2.8,
        pointHoverRadius: 5,
        pointBackgroundColor: points.map((point) => (point.completed ? "#ffffff" : "#b94b3e")),
        pointBorderColor: points.map((point) => (point.completed ? "#0a6ea0" : "#b94b3e")),
        pointBorderWidth: 1.8,
        fill: true,
        tension: 0.25,
      },
      {
        label: "Durchschnitt",
        data: points.map(() => averageDuration),
        borderColor: "#2b8b6f",
        borderDash: [6, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      },
    ];

    if (selectedPointIndex > -1) {
      datasets.push({
        label: "Ausgewählter Vorgang",
        data: points.map((point, index) => (index === selectedPointIndex ? point.durationSeconds : null)),
        borderColor: "#172d3f",
        backgroundColor: selectedPoint?.completed ? "#ffffff" : "#b94b3e",
        pointRadius: 7,
        pointHoverRadius: 7,
        pointBorderColor: "#172d3f",
        pointBorderWidth: 3,
        showLine: false,
      });
    }

    return {
      labels,
      datasets,
    };
  }, [averageDuration, labels, points, selectedPoint, selectedPointIndex]);

  const chartOptions = useMemo<ChartOptions<"line">>(
    () => ({
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 9,
            color: "#566572",
          },
        },
        tooltip: {
          callbacks: {
            title(items) {
              const index = items[0]?.dataIndex ?? 0;
              const point = points[index];

              return point ? `Vorgang ${point.antragId}` : "Vorgang";
            },
            label(context) {
              const point = points[context.dataIndex];

              if (!point) {
                return context.dataset.label ?? "";
              }

              return `${context.dataset.label}: ${formatDuration(point.durationSeconds)}`;
            },
            afterLabel(context) {
              const point = points[context.dataIndex];

              return point ? `${point.userId} / Index ${context.dataIndex + 1}` : "";
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Chronologische Vorgänge im aktuellen Filter",
            color: "#566572",
            font: {
              weight: 700,
            },
          },
          grid: {
            color: "rgba(19, 52, 76, 0.08)",
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 12,
            color: "#566572",
            callback(value, index) {
              return points[index]?.antragId ?? value;
            },
          },
        },
        y: {
          suggestedMax: maxDuration * 1.08,
          title: {
            display: true,
            text: "Benötigte Zeit",
            color: "#566572",
            font: {
              weight: 700,
            },
          },
          grid: {
            color: "rgba(19, 52, 76, 0.12)",
          },
          ticks: {
            color: "#566572",
            callback(value) {
              return formatAxisDuration(value);
            },
          },
        },
      },
    }),
    [maxDuration, points],
  );

  if (points.length < 2) {
    return (
      <div className="pdf-duration-empty">
        <p>Für den aktuellen Filter sind zu wenige Vorgänge für den Dauerverlauf vorhanden.</p>
      </div>
    );
  }

  return (
    <section className="pdf-duration-chart-section">
      <div className="pdf-duration-chart-header">
        <div>
          <p className="section-kicker">Prozessdauer</p>
          <h2>Benötigte Zeit je Vorgang</h2>
        </div>
        <div className="pdf-duration-chart-metrics">
          <article>
            <span>Im Diagramm</span>
            <strong>{points.length}</strong>
          </article>
          <article>
            <span>Maximal</span>
            <strong>{formatDuration(maxDuration)}</strong>
          </article>
          <article>
            <span>Durchschnitt</span>
            <strong>{formatDuration(averageDuration)}</strong>
          </article>
          {updateMarker ? (
            <article>
              <span>Update</span>
              <strong>01.07.</strong>
              <small>
                {updateMarker.beforeCount} davor / {updateMarker.afterCount} danach
              </small>
            </article>
          ) : null}
        </div>
      </div>

      <div className="pdf-duration-chart-shell">
        <Line data={chartData} options={chartOptions} plugins={[updateMarkerPlugin]} />
      </div>
      <p className="pdf-duration-chart-note">
        Der Graph zeigt die letzten sichtbaren Vorgänge im aktuellen Filter chronologisch. Die grüne Linie markiert den
        Durchschnitt, rote Punkte markieren nicht abgeschlossene Vorgänge. Die vertikale Linie markiert das Update am
        01.07.
      </p>
    </section>
  );
}
