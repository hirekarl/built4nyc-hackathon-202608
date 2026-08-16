"use client";

import { useCallback, useRef, useState } from "react";
import Map from "../components/Map";
import ReportPanel, { type ReportPanelState } from "../components/ReportPanel";
import type {
  IntersectionReport,
  IntersectionReportBoundary,
  IntersectionReportPeriod,
  IntersectionReportRequest,
  IntersectionSelection,
} from "../types/report";

const REPORT_BOUNDARY: IntersectionReportBoundary = {
  kind: "circle",
  radiusMeters: 50,
};

const REPORT_PERIOD: IntersectionReportPeriod = {
  startInclusive: "2025-01-01",
  endExclusive: "2026-01-01",
};

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

  const cancelPendingReport = useCallback(() => {
    requestIdRef.current += 1;
  }, []);

  const handleSelect = useCallback(
    (nextSelection: IntersectionSelection) => {
      cancelPendingReport();
      setSelection(nextSelection);
      setReport(null);
      setPanelState("ready");
    },
    [cancelPendingReport],
  );

  const handleGenerate = useCallback(async () => {
    if (!selection) {
      setReport(null);
      setPanelState("validation-error");
      return;
    }

    cancelPendingReport();
    const requestId = requestIdRef.current;
    const requestBody: IntersectionReportRequest = {
      schemaVersion: "1",
      selection,
      boundary: REPORT_BOUNDARY,
      period: REPORT_PERIOD,
    };
    setReport(null);
    setPanelState("loading");

    try {
      const response = await fetch("/api/reports/intersection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (requestId !== requestIdRef.current) return;

      if (!response.ok) {
        setReport(null);
        setPanelState(
          response.status === 400 ? "validation-error" : "source-failure",
        );
        return;
      }

      const nextReport = (await response.json()) as IntersectionReport;
      if (requestId !== requestIdRef.current) return;
      setReport(nextReport);
      setPanelState(stateForReport(nextReport));
    } catch {
      if (requestId !== requestIdRef.current) return;
      setReport(null);
      setPanelState("source-failure");
    }
  }, [cancelPendingReport, selection]);

  const handleClearSelection = useCallback(() => {
    cancelPendingReport();
    setSelection(null);
    setReport(null);
    setPanelState("initial");
  }, [cancelPendingReport]);

  return (
    <main className="map-workspace">
      <div className="map-canvas-shell">
        <Map onSelect={handleSelect} />
      </div>

      <header className="map-brand-overlay">
        <div>
          <p className="eyebrow">Street facts, clearly sourced</p>
          <h1>EZStreet</h1>
        </div>
        <p>
          Select an official intersection and create a deterministic
          street-safety report from NYC Open Data.
        </p>
      </header>

      <ReportPanel
        state={panelState}
        selection={selection}
        report={report}
        onGenerate={handleGenerate}
        onRetry={handleGenerate}
        onClearSelection={handleClearSelection}
      />
    </main>
  );
}
