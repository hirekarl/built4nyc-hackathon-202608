import { useState, useSyncExternalStore } from "react";
import type {
  IntersectionReport,
  IntersectionReportMetrics,
  IntersectionSelection,
  PriorityZoneStatus,
} from "../types/report";
import PrintReport from "./PrintReport";

export type ReportPanelState =
  | "initial"
  | "ready"
  | "loading"
  | "complete"
  | "partial"
  | "zero-match"
  | "validation-error"
  | "source-failure";

export interface ReportPanelProps {
  state: ReportPanelState;
  selection: IntersectionSelection | null;
  report: IntersectionReport | null;
  onGenerate: () => void;
  onRetry: () => void;
  onClearSelection: () => void;
}

const PRIMARY_METRICS: Array<
  [label: string, key: keyof IntersectionReportMetrics]
> = [
  ["Crashes", "crashes"],
  ["People injured", "peopleInjured"],
  ["People killed", "peopleKilled"],
];

const ROAD_USER_METRICS: Array<
  [label: string, key: keyof IntersectionReportMetrics]
> = [
  ["Pedestrians injured", "pedestriansInjured"],
  ["Pedestrians killed", "pedestriansKilled"],
  ["Cyclists injured", "cyclistsInjured"],
  ["Cyclists killed", "cyclistsKilled"],
  ["Motorists injured", "motoristsInjured"],
  ["Motorists killed", "motoristsKilled"],
];

const PRIORITY_LABELS: Record<PriorityZoneStatus, string> = {
  matched: "Matched",
  not_matched: "Not matched",
  unavailable: "Unavailable",
};

function subscribeToPrintSupport(): () => void {
  return () => undefined;
}

function hasBrowserPrintMedia(): boolean {
  return (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
  );
}

function noServerPrintMedia(): boolean {
  return false;
}

function MetricValue({ value }: { value: number | null }) {
  return <>{value === null ? "Unavailable" : value}</>;
}

function MetricList({
  metrics,
  definitions,
  className,
}: {
  metrics: IntersectionReportMetrics;
  definitions: Array<[string, keyof IntersectionReportMetrics]>;
  className?: string;
}) {
  return (
    <dl className={className ?? "metric-list"}>
      {definitions.map(([label, key]) => {
        const value = metrics[key];
        if (typeof value !== "number" && value !== null) return null;
        return (
          <div className="metric-row" key={key}>
            <dt>{label}</dt>
            <dd>
              <MetricValue value={value} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function SelectionSummary({ selection }: { selection: IntersectionSelection }) {
  return (
    <div className="selection-summary">
      <h3>{selection.displayName}</h3>
      <dl className="scope-list">
        <div>
          <dt>Analysis boundary</dt>
          <dd>50 meters (about 164 feet)</dd>
        </div>
        <div>
          <dt>Report period</dt>
          <dd>Calendar year 2025</dd>
        </div>
      </dl>
    </div>
  );
}

function StatusBanner({ report }: { report: IntersectionReport }) {
  const complete = report.status === "complete";
  return (
    <div className={`report-status report-status--${report.status}`}>
      <p className="status-label">
        <span className="status-icon" aria-hidden="true">
          {complete ? "✓" : "!"}
        </span>
        <span>{complete ? "Complete report" : "Partial report"}</span>
      </p>
      {!complete && (
        <p>
          Some required data was unavailable. Available facts are shown below.
        </p>
      )}
    </div>
  );
}

function Factors({ metrics }: { metrics: IntersectionReportMetrics }) {
  const factors = metrics.contributingFactors;
  return (
    <dl className="metric-list factor-list">
      <div className="metric-row metric-row--stacked">
        <dt>Contributing factors</dt>
        <dd>
          {factors === null ? (
            "Unavailable"
          ) : factors.length === 0 ? (
            "No contributing factors were reported."
          ) : (
            <ul>
              {factors.map(({ factor, count }) => (
                <li key={factor}>
                  <span>{factor}</span>: {count}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </div>
      <div className="metric-row">
        <dt>Unspecified</dt>
        <dd>
          <MetricValue value={metrics.unspecifiedFactors} />
        </dd>
      </div>
    </dl>
  );
}

function ReportDetails({ report }: { report: IntersectionReport }) {
  return (
    <article
      className="report-details screen-report"
      aria-label="On-screen safety report"
    >
      <header className="report-identity">
        <h3>{report.selection.displayName}</h3>
        <StatusBanner report={report} />
        <dl className="scope-list">
          <div>
            <dt>Analysis boundary</dt>
            <dd>50 meters (about 164 feet)</dd>
          </div>
          <div>
            <dt>Report period</dt>
            <dd>Calendar year 2025</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{report.generatedAt}</dd>
          </div>
        </dl>
        <p className="report-summary">{report.summary}</p>
      </header>

      <section aria-labelledby="primary-metrics-heading">
        <h4 id="primary-metrics-heading">Headline facts</h4>
        <MetricList
          className="metric-list metric-list--headline"
          metrics={report.metrics}
          definitions={PRIMARY_METRICS}
        />
      </section>

      <section aria-labelledby="road-users-heading">
        <h4 id="road-users-heading">Road users</h4>
        <MetricList metrics={report.metrics} definitions={ROAD_USER_METRICS} />
      </section>

      <section aria-labelledby="factors-heading">
        <h4 id="factors-heading">Contributing factors</h4>
        <Factors metrics={report.metrics} />
      </section>

      <section
        className="priority-zone"
        role="region"
        aria-labelledby="priority-zone-heading"
      >
        <h4 id="priority-zone-heading">Priority Zone</h4>
        <p>{PRIORITY_LABELS[report.priorityZone.status]}</p>
      </section>

      {report.notes.length > 0 && (
        <section aria-labelledby="notes-heading">
          <h4 id="notes-heading">Data-quality notes</h4>
          <ul className="text-list">
            {report.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      {report.limitations.length > 0 && (
        <section aria-labelledby="limitations-heading">
          <h4 id="limitations-heading">Limitations</h4>
          <ul className="text-list">
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sources-heading">
        <h4 id="sources-heading">Sources</h4>
        <ul className="source-list">
          {report.sources.map((source) => (
            <li key={source.datasetId}>
              <a href={source.url}>{source.name}</a>
              <dl>
                <div>
                  <dt>Dataset ID</dt>
                  <dd>{source.datasetId}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{source.role}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{source.retrievalStatus}</dd>
                </div>
                <div>
                  <dt>Retrieved</dt>
                  <dd>{source.retrievedAt ?? "Unavailable"}</dd>
                </div>
              </dl>
              <p>{source.queryDescription}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

export default function ReportPanel({
  state,
  selection,
  report,
  onGenerate,
  onRetry,
  onClearSelection,
}: ReportPanelProps) {
  const browserSupportsPrintMedia = useSyncExternalStore(
    subscribeToPrintSupport,
    hasBrowserPrintMedia,
    noServerPrintMedia,
  );
  const [printRequested, setPrintRequested] = useState(false);
  const hasReport =
    report !== null &&
    (state === "complete" || state === "partial" || state === "zero-match");

  const handlePrint = () => {
    setPrintRequested(true);
    window.print();
  };

  return (
    <>
      <aside
        className="report-panel"
        aria-label="Safety report"
        aria-busy={state === "loading"}
      >
        <div className="panel-heading">
          <p className="eyebrow">NYC Open Data</p>
          <h2>Safety report</h2>
        </div>

        <div className="report-live" aria-live="polite">
          {state === "initial" && (
            <div className="panel-state panel-state--initial">
              <p>Select an intersection to create a safety report.</p>
              <button type="button" className="button button--primary" disabled>
                Generate safety report
              </button>
            </div>
          )}

          {state === "ready" && selection && (
            <div className="panel-state">
              <SelectionSummary selection={selection} />
              <div className="button-row">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={onGenerate}
                >
                  Generate safety report
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={onClearSelection}
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {state === "loading" && (
            <div className="panel-state">
              {selection && <SelectionSummary selection={selection} />}
              <p className="loading-status" role="status">
                <span className="loading-dot" aria-hidden="true" />
                Retrieving NYC Open Data…
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="button button--primary"
                  disabled
                >
                  Generating safety report…
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={onClearSelection}
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {state === "validation-error" && (
            <div className="panel-state">
              <div className="error-message" role="alert">
                This selection could not be analyzed. Choose another official
                intersection and try again.
              </div>
              <button
                type="button"
                className="button button--secondary"
                onClick={onClearSelection}
              >
                Clear selection
              </button>
            </div>
          )}

          {state === "source-failure" && (
            <div className="panel-state">
              <div className="error-message" role="alert">
                Required data could not be loaded. No report facts are available
                for this selection.
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={onRetry}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={onClearSelection}
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {hasReport && (
            <div className="panel-state">
              <ReportDetails report={report} />
              <div className="button-row report-controls">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={handlePrint}
                >
                  Print or save as PDF
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={onClearSelection}
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
      {hasReport && (browserSupportsPrintMedia || printRequested) && (
        <PrintReport report={report} />
      )}
    </>
  );
}
