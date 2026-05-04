"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ReportDurationChart } from "@/components/report-duration-chart";
import { loadReportSnapshot, updateStoredConclusionText, type ReportSnapshot } from "@/lib/report-storage";
import type { AnalysisReport, AntragSummary } from "@/lib/log-types";

const TENANT_NAMES: Record<string, string> = {
  "10099": "infrest",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatDecimal(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(value);
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) {
    return "offen";
  }

  if (seconds < 60) {
    return `${formatDecimal(seconds, 1)} s`;
  }

  if (seconds < 3600) {
    return `${formatDecimal(seconds / 60, 1)} min`;
  }

  return `${formatDecimal(seconds / 3600, 2)} h`;
}

function formatDate(isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

function getSnapshotId(): string | null {
  return new URLSearchParams(window.location.search).get("snapshot");
}

function formatTenantLabel(report: AnalysisReport): string {
  const tenantIds = [...new Set(report.antraege.map((antrag) => antrag.tenantId))];

  if (!tenantIds.length) {
    return "Nicht im Log enthalten";
  }

  return tenantIds
    .map((tenantId) => {
      const tenantName = TENANT_NAMES[tenantId] ?? "Name nicht hinterlegt";

      return `${tenantId} - ${tenantName}`;
    })
    .join(", ");
}

export default function PdfReportPage() {
  const snapshotIdRef = useRef<string | null>(null);
  const conclusionInputRef = useRef<HTMLDivElement | null>(null);
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [conclusionText, setConclusionText] = useState("");

  useEffect(() => {
    const nextSnapshotId = getSnapshotId();

    snapshotIdRef.current = nextSnapshotId;

    if (!nextSnapshotId) {
      return;
    }

    loadReportSnapshot(nextSnapshotId).then((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setConclusionText(nextSnapshot?.conclusionText ?? "");
    });
  }, []);

  useEffect(() => {
    if (!conclusionInputRef.current || conclusionInputRef.current.innerText === conclusionText) {
      return;
    }

    conclusionInputRef.current.innerText = conclusionText;
  }, [conclusionText]);

  const report = snapshot?.report ?? null;
  const normalizedSearch = snapshot?.searchText.trim().toLowerCase() ?? "";
  const filteredAntraege = useMemo(() => {
    if (!report || !snapshot) {
      return [];
    }

    return report.antraege.filter((antrag) => {
      const matchesUser = snapshot.userFilter === "ALL" || antrag.userId === snapshot.userFilter;
      const matchesSearch =
        !normalizedSearch ||
        antrag.antragId.toLowerCase().includes(normalizedSearch) ||
        antrag.userId.toLowerCase().includes(normalizedSearch) ||
        String(antrag.latestState).toLowerCase().includes(normalizedSearch);

      return matchesUser && matchesSearch;
    });
  }, [normalizedSearch, report, snapshot]);
  const selectedAntrag =
    filteredAntraege.find((antrag) => antrag.antragId === snapshot?.selectedAntragId) ?? filteredAntraege[0] ?? null;
  const tenantLabel = report ? formatTenantLabel(report) : "";

  function handleConclusionChange(nextConclusionText: string) {
    setConclusionText(nextConclusionText);

    if (snapshotIdRef.current) {
      void updateStoredConclusionText(snapshotIdRef.current, nextConclusionText);
    }
  }

  if (!snapshot || !report) {
    return (
      <main className="pdf-report-screen">
        <section className="pdf-empty-state">
          <p className="section-kicker">Report</p>
          <h1>Kein Report gefunden</h1>
          <p>
            Öffne den PDF-Bericht direkt aus der Analyseansicht, damit die aktuelle Auswertung für diesen Tab
            bereitgestellt wird.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="pdf-report-screen">
      <nav className="pdf-report-toolbar pdf-no-print">
        <div>
          <strong>PDF-Bericht</strong>
          <span>Druckoptimierte Ansicht</span>
        </div>
        <button onClick={() => window.print()} type="button">
          Drucken / als PDF speichern
        </button>
      </nav>

      <article className="pdf-document">
        <header className="pdf-cover">
          <div className="pdf-brand-row">
            <img alt="infrest Logo" className="pdf-logo" src="/infrest-logo.svg" />
            <div className="pdf-report-label">
              <span>LAP1 Prozessauswertung</span>
              <strong>Kundenreport</strong>
            </div>
          </div>

          <div className="pdf-cover-grid">
            <div>
              <p className="section-kicker">Analysebericht</p>
              <p className="pdf-lead">
                Auswertung der PdbWizard-Prozessdaten mit Fokus auf Abschlussquote, Durchlaufzeiten, Rücksprünge und
                auffällige Prozesspfade.
              </p>
            </div>

            <dl className="pdf-meta-list">
              <div>
                <dt>Kunde / Tenant</dt>
                <dd>{tenantLabel}</dd>
              </div>
              <div>
                <dt>Log-Zeitraum</dt>
                <dd>
                  {formatDate(report.meta.rangeStartedAt)} bis {formatDate(report.meta.rangeEndedAt)}
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="pdf-section">
          <div className="pdf-section-title">
            <p className="section-kicker">Zusammenfassung</p>
            <h2>Kernaussagen</h2>
          </div>

          <div className="pdf-kpi-grid">
            <article>
              <span>Vorgänge</span>
              <strong>{formatNumber(filteredAntraege.length)}</strong>
              <small>{formatNumber(report.meta.transitionEventCount)} Übergänge gesamt</small>
            </article>
            <article>
              <span>Abgeschlossen</span>
              <strong>{formatNumber(report.overview.completedAntraege)}</strong>
              <small>{formatNumber(report.overview.openAntraege)} offen</small>
            </article>
            <article>
              <span>Durchschnitt</span>
              <strong>{formatDuration(report.overview.averageCompletedSeconds)}</strong>
              <small>bis zum Abschluss</small>
            </article>
            <article>
              <span>Nutzer</span>
              <strong>{formatNumber(report.overview.uniqueUsers)}</strong>
              <small>{formatNumber(report.overview.uniqueTenants)} Tenant</small>
            </article>
            <article>
              <span>Rücksprünge</span>
              <strong>{formatNumber(report.overview.backtrackTransitions)}</strong>
              <small>{formatNumber(report.overview.repeatTransitions)} Wiederholungen</small>
            </article>
          </div>

          <div className="pdf-summary-copy">
            <p>
              Im aktuellen Filter sind {formatNumber(filteredAntraege.length)} Vorgänge enthalten. Die mittlere
              abgeschlossene Durchlaufzeit liegt bei {formatDuration(report.overview.averageCompletedSeconds)}.
            </p>
            <p>
              Der Report berücksichtigt den Filter <strong>{snapshot.userFilter === "ALL" ? "Alle Nutzer" : snapshot.userFilter}</strong>
              {snapshot.searchText.trim() ? ` und die Suche "${snapshot.searchText}"` : ""}.
            </p>
          </div>
        </section>

        <ReportDurationChart antraege={filteredAntraege} selectedAntragId={selectedAntrag?.antragId ?? null} />

        <section className="pdf-section pdf-conclusion-detail-page">
          <section className="pdf-detail-section">
            <div className="pdf-section-title">
              <p className="section-kicker">Vorgangsdetail</p>
              <h2>Ausgewählter Vorgang</h2>
            </div>

            {selectedAntrag ? (
              <>
                <div className="pdf-detail-grid">
                  <article>
                    <span>Antrag</span>
                    <strong>{selectedAntrag.antragId}</strong>
                  </article>
                  <article>
                    <span>Nutzer</span>
                    <strong>{selectedAntrag.userId}</strong>
                  </article>
                  <article>
                    <span>Status</span>
                    <strong>{String(selectedAntrag.latestState)}</strong>
                  </article>
                  <article>
                    <span>Dauer</span>
                    <strong>{formatDuration(selectedAntrag.cycleDurationSeconds ?? selectedAntrag.observedDurationSeconds)}</strong>
                  </article>
                </div>

                <div className="pdf-timeline">
                  {selectedAntrag.stepVisits.map((visit, index) => (
                    <article key={`${visit.step}-${visit.enteredAt}-${index}`}>
                      <span>{visit.step}</span>
                      <strong>{formatDuration(visit.durationSeconds)}</strong>
                      <small>
                        {formatDate(visit.enteredAt)} bis {visit.exitedAt ? formatDate(visit.exitedAt) : "offen"}
                      </small>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p>Keine Vorgänge für den aktuellen Filter gefunden.</p>
            )}
          </section>

          <section className="pdf-conclusion-section">
            <div className="pdf-section-title">
              <h2>Fazit</h2>
            </div>
            <div
              aria-label="Fazit für den PDF-Bericht"
              className="pdf-conclusion-input"
              contentEditable
              data-placeholder="Fazit, Einschätzung oder Handlungsempfehlung für den Kundenreport eintragen..."
              ref={conclusionInputRef}
              onInput={(event) => handleConclusionChange(event.currentTarget.innerText)}
              role="textbox"
              suppressContentEditableWarning
            />
          </section>
        </section>

        <section className="pdf-section">
          <div className="pdf-section-title">
            <p className="section-kicker">Vorgangsliste</p>
            <h2>Kompakter Auszug</h2>
          </div>
          <table className="pdf-table">
            <thead>
              <tr>
                <th>Antrag</th>
                <th>Nutzer</th>
                <th>Status</th>
                <th>Ereignisse</th>
                <th>Dauer</th>
                <th>Rücksprünge</th>
              </tr>
            </thead>
            <tbody>
              {filteredAntraege.slice(0, 24).map((antrag: AntragSummary) => (
                <tr key={antrag.antragId}>
                  <td>{antrag.antragId}</td>
                  <td>{antrag.userId}</td>
                  <td>{String(antrag.latestState)}</td>
                  <td>{formatNumber(antrag.eventCount)}</td>
                  <td>{formatDuration(antrag.cycleDurationSeconds ?? antrag.observedDurationSeconds)}</td>
                  <td>{formatNumber(antrag.backtrackCount + antrag.repeatCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </article>
    </main>
  );
}
