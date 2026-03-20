"use client";

import { startTransition, useDeferredValue, useState } from "react";

import { ProcessDurationChart } from "@/components/process-duration-chart";
import type { AnalysisReport, AntragSummary, StepStat, TransitionStat, UserSummary } from "@/lib/log-types";
import { STEP_SEQUENCE } from "@/lib/log-types";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) {
    return "offen";
  }

  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)} min`;
  }

  return `${(seconds / 3600).toFixed(2)} h`;
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
    second: "2-digit",
  }).format(new Date(isoTimestamp));
}

function getRatio(value: number, max: number): string {
  if (!max) {
    return "0%";
  }

  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function sortStepStats(stepStats: StepStat[]): StepStat[] {
  return [...stepStats].sort((left, right) => {
    const leftIndex = STEP_SEQUENCE.indexOf(left.step as (typeof STEP_SEQUENCE)[number]);
    const rightIndex = STEP_SEQUENCE.indexOf(right.step as (typeof STEP_SEQUENCE)[number]);

    if (leftIndex === rightIndex) {
      return right.visitCount - left.visitCount;
    }

    return leftIndex - rightIndex;
  });
}

export function LogAnalyser() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [selectedAntragId, setSelectedAntragId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [userFilter, setUserFilter] = useState("ALL");
  const [loadingState, setLoadingState] = useState<"idle" | "uploading">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchText);

  const visibleUsers = report?.users ?? [];
  const stepStats = sortStepStats(report?.stepStats ?? []);
  const transitionStats = [...(report?.transitionStats ?? [])].slice(0, 12);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredAntraege =
    report?.antraege.filter((antrag) => {
      const matchesUser = userFilter === "ALL" || antrag.userId === userFilter;
      const matchesSearch =
        !normalizedSearch ||
        antrag.antragId.toLowerCase().includes(normalizedSearch) ||
        antrag.userId.toLowerCase().includes(normalizedSearch) ||
        String(antrag.latestState).toLowerCase().includes(normalizedSearch);

      return matchesUser && matchesSearch;
    }) ?? [];
  const selectedAntrag =
    filteredAntraege.find((antrag) => antrag.antragId === selectedAntragId) ??
    report?.antraege.find((antrag) => antrag.antragId === selectedAntragId) ??
    filteredAntraege[0] ??
    null;
  const printUsers = visibleUsers.slice(0, 12);
  const printAntraege = filteredAntraege.slice(0, 18);
  const printTransitions = selectedAntrag?.transitions.slice(0, 12) ?? [];
  const maxStepDuration = Math.max(...stepStats.map((item) => item.averageDurationSeconds), 1);
  const maxTransitionCount = Math.max(...transitionStats.map((item) => item.count), 1);
  const reportGeneratedAt = formatDate(new Date().toISOString());

  async function analyseUpload(endpoint: string, body?: FormData) {
    try {
      setErrorMessage(null);

      const response = await fetch(endpoint, {
        method: body ? "POST" : "GET",
        body,
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error ?? "Die Analyse konnte nicht gestartet werden.");
      }

      const nextReport = (await response.json()) as AnalysisReport;

      startTransition(() => {
        setReport(nextReport);
        setUserFilter("ALL");
        setSearchText("");
        setSelectedAntragId(nextReport.antraege[0]?.antragId ?? null);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unbekannter Analysefehler.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setErrorMessage("Bitte zuerst eine Log-Datei auswählen.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setLoadingState("uploading");
    await analyseUpload("/api/analyse", formData);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <section className="workspace">
      <section className="panel upload-panel no-print">
        <div>
          <p className="section-kicker">Ingest</p>
          <h2>Log-Datei analysieren</h2>
          <p className="section-copy">
            Upload per Browser. Die Analyse läuft serverseitig und verarbeitet nur die PdbWizard-Zeilen.
          </p>
        </div>

        <form className="upload-form" onSubmit={handleUploadSubmit}>
          <label className="file-picker">
            <span>{file ? file.name : "Log-Datei auswählen"}</span>
            <input
              accept=".log,.txt"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>

          <div className="button-row">
            <button disabled={loadingState !== "idle"} type="submit">
              {loadingState === "uploading" ? "Upload läuft..." : "Upload analysieren"}
            </button>
          </div>
        </form>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
      </section>

      {report ? (
        <>
          <section className="panel report-toolbar no-print">
            <div>
              <p className="section-kicker">Report</p>
              <h2>Druck- und Reportansicht</h2>
              <p className="section-copy">
                Der Druck übernimmt die aktuelle Filterung und blendet alle interaktiven Bedienelemente aus.
              </p>
            </div>
            <div className="button-row">
              <button onClick={handlePrint} type="button">
                Report drucken
              </button>
            </div>
          </section>

          <section className="print-report-header print-only">
            <div className="print-brand-row">
              <div>
                <img alt="infrest Logo" className="print-logo" src="/infrest-logo.svg" />
                <p className="section-kicker">infrest LAP1 Analysebericht</p>
                <h1 className="print-report-title">{report.meta.fileName}</h1>
              </div>
              <div className="print-report-meta">
                <span>Erstellt: {reportGeneratedAt}</span>
                <span>Dateigröße: {formatBytes(report.meta.sizeBytes)}</span>
                <span>Encoding: {report.meta.encoding}</span>
              </div>
            </div>

            <div className="print-summary-grid">
              <article>
                <span>Filter</span>
                <strong>{userFilter === "ALL" ? "Alle User" : userFilter}</strong>
              </article>
              <article>
                <span>Suchbegriff</span>
                <strong>{searchText.trim() ? searchText : "Kein Suchfilter"}</strong>
              </article>
              <article>
                <span>Gefilterte Vorgänge</span>
                <strong>{formatNumber(filteredAntraege.length)}</strong>
              </article>
              <article>
                <span>Ausgewählter Vorgang</span>
                <strong>{selectedAntrag?.antragId ?? "Keiner"}</strong>
              </article>
            </div>
          </section>

          <section className="print-page print-only">
            <section className="print-section">
              <div className="print-section-header">
                <div>
                  <p className="section-kicker">Überblick</p>
                  <h2>{report.meta.fileName}</h2>
                </div>
              </div>

              <div className="stats-grid print-stats-grid">
                <article className="stat-card">
                  <span>Users</span>
                  <strong>{formatNumber(report.overview.uniqueUsers)}</strong>
                  <small>{formatNumber(report.overview.uniqueTenants)} Tenant(s)</small>
                </article>
                <article className="stat-card">
                  <span>Anträge</span>
                  <strong>{formatNumber(report.overview.uniqueAntraege)}</strong>
                  <small>{formatNumber(report.meta.transitionEventCount)} Transitionen</small>
                </article>
                <article className="stat-card">
                  <span>Abgeschlossen</span>
                  <strong>{formatNumber(report.overview.completedAntraege)}</strong>
                  <small>{formatNumber(report.overview.openAntraege)} offen</small>
                </article>
                <article className="stat-card">
                  <span>Ø Fertig in</span>
                  <strong>{formatDuration(report.overview.averageCompletedSeconds)}</strong>
                  <small>{report.meta.matchedCreateEventCount} Start-Events verknüpft</small>
                </article>
              </div>
            </section>

            <section className="print-section">
              <div className="insight-grid">
                <section>
                  <div className="print-section-header">
                    <div>
                      <p className="section-kicker">Step Durations</p>
                      <h2>Wo Zeit hängen bleibt</h2>
                    </div>
                  </div>

                  <div className="chart-list">
                    {stepStats.map((step) => (
                      <div className="chart-row" key={`print-${step.step}`}>
                        <div className="chart-copy">
                          <strong>{step.step}</strong>
                          <span>
                            {formatDuration(step.averageDurationSeconds)} Ø bei {formatNumber(step.visitCount)} Besuchen
                          </span>
                        </div>
                        <div className="chart-bar-track">
                          <div
                            className="chart-bar-fill warm-fill"
                            style={{ width: getRatio(step.averageDurationSeconds, maxStepDuration) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="print-section-header">
                    <div>
                      <p className="section-kicker">Transition Mix</p>
                      <h2>Häufigste Übergänge</h2>
                    </div>
                  </div>

                  <div className="chart-list">
                    {transitionStats.map((transition: TransitionStat) => (
                      <div className="chart-row" key={`print-${transition.label}`}>
                        <div className="chart-copy">
                          <strong>{transition.label}</strong>
                          <span>{formatNumber(transition.count)} Treffer</span>
                        </div>
                        <div className="chart-bar-track">
                          <div
                            className="chart-bar-fill cool-fill"
                            style={{ width: getRatio(transition.count, maxTransitionCount) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </section>

            <section className="print-section">
              <ProcessDurationChart antraege={filteredAntraege} selectedAntragId={selectedAntrag?.antragId ?? null} />
            </section>
          </section>

          <section className="panel no-print">
            <div className="section-header">
              <div>
                <p className="section-kicker">Überblick</p>
                <h2>{report.meta.fileName}</h2>
              </div>
              <div className="meta-chip-row">
                <span className="meta-chip">{formatBytes(report.meta.sizeBytes)}</span>
                <span className="meta-chip">{report.meta.encoding}</span>
                <span className="meta-chip">{formatNumber(report.meta.lineCount)} Zeilen</span>
              </div>
            </div>

            <div className="stats-grid">
              <article className="stat-card">
                <span>Users</span>
                <strong>{formatNumber(report.overview.uniqueUsers)}</strong>
                <small>{formatNumber(report.overview.uniqueTenants)} Tenant(s)</small>
              </article>
              <article className="stat-card">
                <span>Anträge</span>
                <strong>{formatNumber(report.overview.uniqueAntraege)}</strong>
                <small>{formatNumber(report.meta.transitionEventCount)} Transitionen</small>
              </article>
              <article className="stat-card">
                <span>Abgeschlossen</span>
                <strong>{formatNumber(report.overview.completedAntraege)}</strong>
                <small>{formatNumber(report.overview.openAntraege)} offen</small>
              </article>
              <article className="stat-card">
                <span>Ø Fertig in</span>
                <strong>{formatDuration(report.overview.averageCompletedSeconds)}</strong>
                <small>{report.meta.matchedCreateEventCount} Start-Events verknüpft</small>
              </article>
              <article className="stat-card accent-card">
                <span>Backtracks</span>
                <strong>{formatNumber(report.overview.backtrackTransitions)}</strong>
                <small>{formatNumber(report.overview.repeatTransitions)} Repeats</small>
              </article>
            </div>
          </section>

          <section className="insight-grid no-print">
            <section className="panel">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Step Durations</p>
                  <h2>Wo Zeit hängen bleibt</h2>
                </div>
              </div>

              <div className="chart-list">
                {stepStats.map((step) => (
                  <div className="chart-row" key={step.step}>
                    <div className="chart-copy">
                      <strong>{step.step}</strong>
                      <span>
                        {formatDuration(step.averageDurationSeconds)} Ø bei {formatNumber(step.visitCount)} Besuchen
                      </span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar-fill warm-fill"
                        style={{ width: getRatio(step.averageDurationSeconds, maxStepDuration) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Transition Mix</p>
                  <h2>Häufigste Übergänge</h2>
                </div>
              </div>

              <div className="chart-list">
                {transitionStats.map((transition: TransitionStat) => (
                  <div className="chart-row" key={transition.label}>
                    <div className="chart-copy">
                      <strong>{transition.label}</strong>
                      <span>{formatNumber(transition.count)} Treffer</span>
                    </div>
                    <div className="chart-bar-track">
                      <div className="chart-bar-fill cool-fill" style={{ width: getRatio(transition.count, maxTransitionCount) }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="panel no-print">
            <div className="section-header">
              <div>
                <p className="section-kicker">User Lens</p>
                <h2>Bearbeitung nach User</h2>
              </div>
            </div>

            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Anträge</th>
                    <th>Abgeschlossen</th>
                    <th>Completion</th>
                    <th>Ø Fertig in</th>
                    <th>Backtracks</th>
                    <th>Letzte Aktivität</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.slice(0, 20).map((user: UserSummary) => (
                    <tr key={`${user.tenantId}-${user.userId}`}>
                      <td>
                        <button className="table-link" onClick={() => setUserFilter(user.userId)} type="button">
                          {user.userId}
                        </button>
                      </td>
                      <td>{formatNumber(user.antragCount)}</td>
                      <td>{formatNumber(user.completedCount)}</td>
                      <td>{user.completionRate.toFixed(1)}%</td>
                      <td>{formatDuration(user.averageCompletedSeconds)}</td>
                      <td>{formatNumber(user.backtrackCount)}</td>
                      <td>{formatDate(user.latestActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel no-print">
            <div className="section-header split-header">
              <div>
                <p className="section-kicker">Case Drilldown</p>
                <h2>Anträge und Prozesspfade</h2>
              </div>
              <div className="filters no-print">
                <input
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Antrag, User oder State suchen"
                  type="search"
                  value={searchText}
                />
                <select onChange={(event) => setUserFilter(event.target.value)} value={userFilter}>
                  <option value="ALL">Alle User</option>
                  {visibleUsers.map((user) => (
                    <option key={`${user.tenantId}-${user.userId}`} value={user.userId}>
                      {user.userId}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="print-only print-filter-caption">
              Aktive Auswahl: {userFilter === "ALL" ? "Alle User" : userFilter} · Suche:{" "}
              {searchText.trim() ? searchText : "Kein Suchfilter"}
            </div>

            <div className="case-layout">
              <div className="table-shell compact-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Antrag</th>
                      <th>User</th>
                      <th>Status</th>
                      <th>Events</th>
                      <th>Dauer</th>
                      <th>Backtracks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAntraege.slice(0, 200).map((antrag: AntragSummary) => (
                      <tr
                        className={selectedAntrag?.antragId === antrag.antragId ? "selected-row" : undefined}
                        key={antrag.antragId}
                      >
                        <td>
                          <button className="table-link" onClick={() => setSelectedAntragId(antrag.antragId)} type="button">
                            {antrag.antragId}
                          </button>
                        </td>
                        <td>{antrag.userId}</td>
                        <td>{String(antrag.latestState)}</td>
                        <td>{formatNumber(antrag.eventCount)}</td>
                        <td>{formatDuration(antrag.cycleDurationSeconds ?? antrag.observedDurationSeconds)}</td>
                        <td>{formatNumber(antrag.backtrackCount + antrag.repeatCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <section className="detail-card">
                {selectedAntrag ? (
                  <>
                    <div className="detail-header">
                      <div>
                        <p className="section-kicker">Detail</p>
                        <h3>Antrag {selectedAntrag.antragId}</h3>
                      </div>
                      <div className="meta-chip-row">
                        <span className="meta-chip">{selectedAntrag.userId}</span>
                        <span className="meta-chip">{selectedAntrag.sessionKey}</span>
                        <span className="meta-chip">{String(selectedAntrag.latestState)}</span>
                      </div>
                    </div>

                    <div className="detail-facts">
                      <article>
                        <span>Start</span>
                        <strong>{formatDate(selectedAntrag.startedAt)}</strong>
                      </article>
                      <article>
                        <span>Erstmalig fertig</span>
                        <strong>{formatDate(selectedAntrag.firstCompletedAt)}</strong>
                      </article>
                      <article>
                        <span>Final fertig</span>
                        <strong>{formatDate(selectedAntrag.completedAt)}</strong>
                      </article>
                    </div>

                    <div className="timeline">
                      {selectedAntrag.stepVisits.map((visit, index) => (
                        <article className="timeline-card" key={`${visit.step}-${visit.enteredAt}-${index}`}>
                          <span>{visit.step}</span>
                          <strong>{formatDuration(visit.durationSeconds)}</strong>
                          <small>
                            {formatDate(visit.enteredAt)} {visit.exitedAt ? `→ ${formatDate(visit.exitedAt)}` : "→ offen"}
                          </small>
                        </article>
                      ))}
                    </div>

                    <div className="transition-list">
                      {selectedAntrag.transitions.map((transition) => (
                        <div className="transition-item" key={`${transition.lineNumber}-${transition.timestamp}`}>
                          <div>
                            <strong>
                              {transition.currentState} → {transition.nextState}
                            </strong>
                            <small>
                              Zeile {transition.lineNumber} · #{transition.operationCode} · {transition.level}
                            </small>
                          </div>
                          <span>{formatDate(transition.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <p>Keine Anträge für den aktuellen Filter gefunden.</p>
                  </div>
                )}
              </section>
            </div>

            <ProcessDurationChart antraege={filteredAntraege} selectedAntragId={selectedAntrag?.antragId ?? null} />
          </section>

          <section className="print-page print-only">
            <section className="print-section">
              <div className="print-section-header">
                <div>
                  <p className="section-kicker">User Lens</p>
                  <h2>Top User im aktuellen Filter</h2>
                </div>
              </div>

              <div className="print-table-shell">
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Anträge</th>
                      <th>Abgeschlossen</th>
                      <th>Ø Fertig in</th>
                      <th>Backtracks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printUsers.map((user: UserSummary) => (
                      <tr key={`print-user-${user.tenantId}-${user.userId}`}>
                        <td>{user.userId}</td>
                        <td>{formatNumber(user.antragCount)}</td>
                        <td>{formatNumber(user.completedCount)}</td>
                        <td>{formatDuration(user.averageCompletedSeconds)}</td>
                        <td>{formatNumber(user.backtrackCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="print-section">
              <div className="print-section-header">
                <div>
                  <p className="section-kicker">Case Drilldown</p>
                  <h2>Kompakte Vorgangsliste</h2>
                </div>
              </div>

              <div className="print-table-shell">
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Antrag</th>
                      <th>User</th>
                      <th>Status</th>
                      <th>Events</th>
                      <th>Dauer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printAntraege.map((antrag: AntragSummary) => (
                      <tr key={`print-antrag-${antrag.antragId}`}>
                        <td>{antrag.antragId}</td>
                        <td>{antrag.userId}</td>
                        <td>{String(antrag.latestState)}</td>
                        <td>{formatNumber(antrag.eventCount)}</td>
                        <td>{formatDuration(antrag.cycleDurationSeconds ?? antrag.observedDurationSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedAntrag ? (
              <section className="print-section">
                <div className="print-section-header">
                  <div>
                    <p className="section-kicker">Ausgewählter Vorgang</p>
                    <h2>Antrag {selectedAntrag.antragId}</h2>
                  </div>
                </div>

                <div className="print-detail-grid">
                  <article>
                    <span>User</span>
                    <strong>{selectedAntrag.userId}</strong>
                  </article>
                  <article>
                    <span>Session</span>
                    <strong>{selectedAntrag.sessionKey}</strong>
                  </article>
                  <article>
                    <span>Start</span>
                    <strong>{formatDate(selectedAntrag.startedAt)}</strong>
                  </article>
                  <article>
                    <span>Status</span>
                    <strong>{String(selectedAntrag.latestState)}</strong>
                  </article>
                </div>

                <div className="print-table-shell">
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th>Eintritt</th>
                        <th>Austritt</th>
                        <th>Dauer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAntrag.stepVisits.slice(0, 8).map((visit, index) => (
                        <tr key={`print-visit-${visit.step}-${index}`}>
                          <td>{visit.step}</td>
                          <td>{formatDate(visit.enteredAt)}</td>
                          <td>{visit.exitedAt ? formatDate(visit.exitedAt) : "offen"}</td>
                          <td>{formatDuration(visit.durationSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {printTransitions.length ? (
                  <div className="print-table-shell">
                    <table className="print-table">
                      <thead>
                        <tr>
                          <th>Zeit</th>
                          <th>Übergang</th>
                          <th>Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printTransitions.map((transition) => (
                          <tr key={`print-transition-${transition.lineNumber}`}>
                            <td>{formatDate(transition.timestamp)}</td>
                            <td>
                              {transition.currentState} → {transition.nextState}
                            </td>
                            <td>
                              #{transition.operationCode} / {transition.level}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ) : null}
          </section>
        </>
      ) : (
        <section className="panel empty-panel">
          <p className="section-kicker">Ready</p>
          <h2>Das Dashboard wartet auf den ersten Import.</h2>
          <p className="section-copy">
            Sobald ein Log geladen ist, erscheinen hier User-Sichten, Transition-Mix, Durchlaufzeiten und die erste
            Detailtimeline pro Antrag.
          </p>
        </section>
      )}
    </section>
  );
}
