import type {
  IntersectionReport,
  IntersectionReportMetrics,
  PriorityZoneStatus,
} from "../types/report";

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

function value(value: number | null): number | "Unavailable" {
  return value === null ? "Unavailable" : value;
}

function Metrics({
  report,
  definitions,
}: {
  report: IntersectionReport;
  definitions: Array<[string, keyof IntersectionReportMetrics]>;
}) {
  return (
    <dl className="metric-list">
      {definitions.map(([label, key]) => {
        const metric = report.metrics[key];
        if (typeof metric !== "number" && metric !== null) return null;
        return (
          <div className="metric-row" key={key}>
            <dt>{label}</dt>
            <dd>{value(metric)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Factors({ report }: { report: IntersectionReport }) {
  const factors = report.metrics.contributingFactors;
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
        <dd>{value(report.metrics.unspecifiedFactors)}</dd>
      </div>
    </dl>
  );
}

export default function PrintReport({
  report,
}: {
  report: IntersectionReport;
}) {
  const complete = report.status === "complete";

  return (
    <article
      className="print-report report-details"
      aria-label="Printable safety report"
    >
      <header className="report-identity">
        <p className="eyebrow">EZStreet safety report</p>
        <h2>{report.selection.displayName}</h2>
        <div className={`report-status report-status--${report.status}`}>
          <p className="status-label">
            <span className="status-icon" aria-hidden="true">
              {complete ? "✓" : "!"}
            </span>
            <span>{complete ? "Complete report" : "Partial report"}</span>
          </p>
          {!complete && (
            <p>
              Some required data was unavailable. Available facts are shown
              below.
            </p>
          )}
        </div>
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

      <section aria-labelledby="print-primary-metrics-heading">
        <h3 id="print-primary-metrics-heading">Headline facts</h3>
        <Metrics report={report} definitions={PRIMARY_METRICS} />
      </section>

      <section aria-labelledby="print-road-users-heading">
        <h3 id="print-road-users-heading">Road users</h3>
        <Metrics report={report} definitions={ROAD_USER_METRICS} />
      </section>

      <section aria-labelledby="print-factors-heading">
        <h3 id="print-factors-heading">Contributing factors</h3>
        <Factors report={report} />
      </section>

      <section aria-labelledby="print-priority-zone-heading">
        <h3 id="print-priority-zone-heading">Priority Zone</h3>
        <p>{PRIORITY_LABELS[report.priorityZone.status]}</p>
      </section>

      {report.notes.length > 0 && (
        <section aria-labelledby="print-notes-heading">
          <h3 id="print-notes-heading">Data-quality notes</h3>
          <ul className="text-list">
            {report.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      {report.limitations.length > 0 && (
        <section aria-labelledby="print-limitations-heading">
          <h3 id="print-limitations-heading">Limitations</h3>
          <ul className="text-list">
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="print-sources-heading">
        <h3 id="print-sources-heading">Sources</h3>
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
