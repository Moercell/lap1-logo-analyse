"use client";

import { useMemo, useState } from "react";
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
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type { AntragSummary } from "@/lib/log-types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

type ChartMode = "single" | "byUser";

interface ProcessDurationChartProps {
  antraege: AntragSummary[];
  selectedAntragId: string | null;
}

interface VisibleAntrag {
  antragId: string;
  userId: string;
  startedAt: string;
  durationSeconds: number;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)} min`;
  }

  return `${(seconds / 3600).toFixed(2)} h`;
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

function getColor(index: number): { border: string; background: string } {
  const palette = [
    { border: "#0a6ea0", background: "rgba(10, 110, 160, 0.14)" },
    { border: "#005f78", background: "rgba(0, 95, 120, 0.14)" },
    { border: "#1d7fa7", background: "rgba(29, 127, 167, 0.14)" },
    { border: "#4ba3c7", background: "rgba(75, 163, 199, 0.14)" },
    { border: "#15708e", background: "rgba(21, 112, 142, 0.14)" },
    { border: "#2b8b6f", background: "rgba(43, 139, 111, 0.14)" },
    { border: "#4064b3", background: "rgba(64, 100, 179, 0.14)" },
    { border: "#789d2b", background: "rgba(120, 157, 43, 0.14)" },
    { border: "#b27818", background: "rgba(178, 120, 24, 0.14)" },
    { border: "#b94b3e", background: "rgba(185, 75, 62, 0.14)" },
  ];

  if (index < palette.length) {
    return palette[index];
  }

  const hue = (index * 41) % 360;

  return {
    border: `hsl(${hue} 68% 42%)`,
    background: `hsl(${hue} 68% 42% / 0.14)`,
  };
}

function toVisibleAntrag(antrag: AntragSummary): VisibleAntrag {
  return {
    antragId: antrag.antragId,
    userId: antrag.userId,
    startedAt: antrag.startedAt,
    durationSeconds: antrag.cycleDurationSeconds ?? antrag.observedDurationSeconds,
  };
}

export function ProcessDurationChart({ antraege, selectedAntragId }: ProcessDurationChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("single");
  const [pointLimitInput, setPointLimitInput] = useState("60");
  const [minScaleInput, setMinScaleInput] = useState("");
  const [maxScaleInput, setMaxScaleInput] = useState("");

  const pointLimit = Number(pointLimitInput);
  const visibleAntraege = useMemo(() => {
    const sorted = [...antraege]
      .map(toVisibleAntrag)
      .sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime());

    if (Number.isFinite(pointLimit) && pointLimit > 0) {
      return sorted.slice(-pointLimit);
    }

    return sorted;
  }, [antraege, pointLimit]);

  const labels = visibleAntraege.map((_, index) => `${index + 1}`);
  const selectedIndex = visibleAntraege.findIndex((antrag) => antrag.antragId === selectedAntragId);
  const maxDataValue = Math.max(...visibleAntraege.map((antrag) => antrag.durationSeconds), 1);
  const parsedMin = minScaleInput.trim() === "" ? undefined : Number(minScaleInput);
  const parsedMax = maxScaleInput.trim() === "" ? undefined : Number(maxScaleInput);
  const normalizedMin = Number.isFinite(parsedMin) ? parsedMin : undefined;
  const normalizedMax = Number.isFinite(parsedMax) ? parsedMax : undefined;

  const chartData = useMemo<ChartData<"line">>(() => {
    const datasets: ChartDataset<"line">[] = [];

    if (chartMode === "single") {
      datasets.push({
        label: "Prozessdauer",
        data: visibleAntraege.map((antrag) => antrag.durationSeconds),
        borderColor: "#0a6ea0",
        backgroundColor: "rgba(10, 110, 160, 0.16)",
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#0a6ea0",
        pointBorderWidth: 2,
        fill: true,
        tension: 0.28,
      });
    } else {
      const users = [...new Set(visibleAntraege.map((antrag) => antrag.userId))];

      users.forEach((userId, index) => {
        const color = getColor(index);

        datasets.push({
          label: userId,
          data: visibleAntraege.map((antrag) => (antrag.userId === userId ? antrag.durationSeconds : null)),
          borderColor: color.border,
          backgroundColor: color.background,
          borderWidth: 2.5,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          spanGaps: false,
          fill: false,
          tension: 0.22,
        });
      });
    }

    if (selectedIndex > -1) {
      datasets.push({
        label: "Ausgewählter Vorgang",
        data: visibleAntraege.map((antrag, index) => (index === selectedIndex ? antrag.durationSeconds : null)),
        borderColor: "#b94b3e",
        backgroundColor: "#b94b3e",
        pointRadius: 6,
        pointHoverRadius: 7,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 3,
        showLine: false,
      });
    }

    return {
      labels,
      datasets,
    };
  }, [chartMode, labels, selectedIndex, visibleAntraege]);

  const chartOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: chartMode === "byUser",
          position: "bottom",
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            color: "#5d788c",
          },
        },
        tooltip: {
          callbacks: {
            title(items) {
              const index = items[0]?.dataIndex ?? 0;
              const antrag = visibleAntraege[index];

              return antrag ? `Vorgang ${antrag.antragId}` : "Vorgang";
            },
            label(context) {
              const antrag = visibleAntraege[context.dataIndex];

              if (!antrag) {
                return context.dataset.label ?? "";
              }

              if (context.dataset.label === "Ausgewählter Vorgang") {
                return `Markiert: ${formatDuration(antrag.durationSeconds)}`;
              }

              return `${antrag.userId}: ${formatDuration(antrag.durationSeconds)}`;
            },
            afterLabel(context) {
              const antrag = visibleAntraege[context.dataIndex];

              return antrag ? `Index ${context.dataIndex + 1}` : "";
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: chartMode === "single" ? "Chronologische Vorgänge" : "Chronologische Vorgänge im Filter",
            color: "#5d788c",
            font: {
              weight: 700,
            },
          },
          grid: {
            color: "rgba(10, 110, 160, 0.08)",
          },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 10,
            color: "#5d788c",
            callback(value, index) {
              return visibleAntraege[index]?.antragId ?? value;
            },
          },
        },
        y: {
          min: normalizedMin,
          max: normalizedMax,
          title: {
            display: true,
            text: "Prozessdauer in Sekunden",
            color: "#5d788c",
            font: {
              weight: 700,
            },
          },
          grid: {
            color: "rgba(10, 110, 160, 0.12)",
          },
          ticks: {
            color: "#5d788c",
            callback(value) {
              return formatAxisDuration(value);
            },
          },
        },
      },
    }),
    [chartMode, normalizedMax, normalizedMin, visibleAntraege],
  );

  return (
    <section className="duration-chart-panel">
      <div className="section-header">
        <div>
          <p className="section-kicker">Process Spread</p>
          <h2>Gesamtzeit je Vorgang</h2>
        </div>
        <div className="meta-chip-row">
          <span className="meta-chip">{formatNumber(visibleAntraege.length)} Vorgänge im Chart</span>
          <span className="meta-chip">Auto-Max {formatDuration(maxDataValue)}</span>
        </div>
      </div>

      <div className="chart-controls no-print">
        <label className="chart-control">
          <span>Ansicht</span>
          <select onChange={(event) => setChartMode(event.target.value as ChartMode)} value={chartMode}>
            <option value="single">Eine Linie</option>
            <option value="byUser">Mehrere Linien nach User</option>
          </select>
        </label>

        <label className="chart-control">
          <span>Wie viele Vorgänge</span>
          <input
            inputMode="numeric"
            min="0"
            onChange={(event) => setPointLimitInput(event.target.value)}
            placeholder="0 = alle"
            type="number"
            value={pointLimitInput}
          />
        </label>

        <label className="chart-control">
          <span>Y-Min in Sekunden</span>
          <input
            inputMode="numeric"
            onChange={(event) => setMinScaleInput(event.target.value)}
            placeholder="auto"
            type="number"
            value={minScaleInput}
          />
        </label>

        <label className="chart-control">
          <span>Y-Max in Sekunden</span>
          <input
            inputMode="numeric"
            onChange={(event) => setMaxScaleInput(event.target.value)}
            placeholder="auto"
            type="number"
            value={maxScaleInput}
          />
        </label>
      </div>

      <div className="print-only print-chart-summary">
        Ansicht: {chartMode === "single" ? "Eine Linie" : "Mehrere Linien nach User"} · Vorgänge im Chart:{" "}
        {formatNumber(visibleAntraege.length)} · Y-Skala: {normalizedMin ?? "auto"} bis {normalizedMax ?? "auto"}
      </div>

      {visibleAntraege.length > 1 ? (
        <div className="chart-canvas-shell">
          <div className="chart-canvas">
            <Line data={chartData} options={chartOptions} />
          </div>
          <p className="chart-footnote">
            {chartMode === "single"
              ? "Die Linie zeigt die aktuell gefilterten Vorgänge in zeitlicher Reihenfolge."
              : "In der Mehrlinien-Ansicht wird pro User eine eigene Linie gezeichnet. Die X-Achse bleibt die chronologische Reihenfolge der sichtbaren Vorgänge."}
          </p>
        </div>
      ) : (
        <div className="empty-state chart-empty-state">
          <p>Für die aktuellen Filter sind zu wenige Vorgänge für eine Liniengrafik vorhanden.</p>
        </div>
      )}
    </section>
  );
}
