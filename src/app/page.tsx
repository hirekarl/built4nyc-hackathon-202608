"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map from "../components/Map";
import ReportPanel, { type ReportPanelState } from "../components/ReportPanel";
import {
  e42AtParkAveReportMock,
  w40At5AveReportMock,
} from "../lib/mocks/report.mock";
import type {
  IntersectionReport,
  IntersectionSelection,
} from "../types/report";

const SOURCE_BACKED_REPORTS: IntersectionReport[] = [
  w40At5AveReportMock,
  e42AtParkAveReportMock,
];
const MOCK_REPORT_PREVIEW_DELAY_MS = 250;

function reportForCoordinate(
  selection: IntersectionSelection,
): IntersectionReport | null {
  return (
    SOURCE_BACKED_REPORTS.find(
      (report) =>
        report.selection.coordinate.latitude ===
          selection.coordinate.latitude &&
        report.selection.coordinate.longitude ===
          selection.coordinate.longitude,
    ) ?? null
  );
}

function stateForReport(report: IntersectionReport): ReportPanelState {
  if (report.metrics.crashes === 0) return "zero-match";
  return report.status;
}

export default function Home() {
  const [selection, setSelection] = useState<IntersectionSelection | null>(
    null,
  );
  const [report, setReport] = useState<IntersectionReport | null>(null);
  const [panelState, setPanelState] = useState<ReportPanelState>("initial");
  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingReport = useCallback(() => {
    requestIdRef.current += 1;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingReport, [cancelPendingReport]);

  const handleSelect = useCallback(
    (nextSelection: IntersectionSelection) => {
      cancelPendingReport();
      setSelection(nextSelection);
      setReport(null);
      setPanelState("ready");
    },
    [cancelPendingReport],
  );

  const handleGenerate = useCallback(() => {
    if (!selection) {
      setReport(null);
      setPanelState("validation-error");
      return;
    }

    cancelPendingReport();
    const requestId = requestIdRef.current;
    setReport(null);
    setPanelState("loading");

    timerRef.current = setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      timerRef.current = null;
      const matchedReport = reportForCoordinate(selection);
      if (!matchedReport) {
        setReport(null);
        setPanelState("source-failure");
        return;
      }
      setReport(matchedReport);
      setPanelState(stateForReport(matchedReport));
    }, MOCK_REPORT_PREVIEW_DELAY_MS);
  }, [cancelPendingReport, selection]);

  const handleClearSelection = useCallback(() => {
    cancelPendingReport();
    setSelection(null);
    setReport(null);
    setPanelState("initial");
  }, [cancelPendingReport]);

  return (
    <main className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">Street facts, clearly sourced</p>
          <h1>EZStreet</h1>
        </div>
        <p>
          Select an official intersection and create a deterministic
          street-safety report from NYC Open Data.
        </p>
      </header>

      <div className="workspace">
        <div className="map-column">
          <Map onSelect={handleSelect} />
        </div>
        <ReportPanel
          state={panelState}
          selection={selection}
          report={report}
          onGenerate={handleGenerate}
          onRetry={handleGenerate}
          onClearSelection={handleClearSelection}
        />
      </div>
    </main>
  );
}
