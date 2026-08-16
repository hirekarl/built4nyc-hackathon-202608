"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map from "../components/Map";
import ReportPanel, { type ReportPanelState } from "../components/ReportPanel";
import {
  SERVER_PERIOD_END,
  SERVER_PERIOD_START,
  SERVER_RADIUS_METERS,
} from "../lib/validation";
import type {
  IntersectionReport,
  IntersectionReportBoundary,
  IntersectionReportPeriod,
  IntersectionReportRequest,
  IntersectionSelection,
} from "../types/report";

// Built from the server-owned constants (not re-declared literals) so the
// client can never drift from what `validateReportRequest` actually accepts
// — see src/lib/validation.ts for why these are the sole source of truth.
const REPORT_BOUNDARY: IntersectionReportBoundary = {
  kind: "circle",
  radiusMeters: SERVER_RADIUS_METERS,
};

const REPORT_PERIOD: IntersectionReportPeriod = {
  startInclusive: SERVER_PERIOD_START,
  endExclusive: SERVER_PERIOD_END,
};

// Generous relative to observed live Socrata round trips (~1-3s) — bounds a
// hung request without making a healthy-but-slow request look broken.
const REPORT_FETCH_TIMEOUT_MS = 30_000;

function stateForReport(report: IntersectionReport): ReportPanelState {
  if (report.metrics.crashes === 0) return "zero-match";
  return report.status;
}

/**
 * Combines a per-request abort controller (aborted by `cancelPendingReport`
 * when a newer selection/unmount supersedes this request) with a bounded
 * timeout, so a hung route surfaces the honest `source-failure` state
 * instead of leaving the panel on "Retrieving NYC Open Data…" forever.
 */
function createReportRequestSignal(controller: AbortController): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(REPORT_FETCH_TIMEOUT_MS);
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([controller.signal, timeoutSignal]);
  }
  // Fallback for runtimes without AbortSignal.any: forward whichever of the
  // two fires first onto the request controller itself.
  timeoutSignal.addEventListener(
    "abort",
    () => controller.abort(timeoutSignal.reason),
    { once: true },
  );
  return controller.signal;
}

export default function Home() {
  const [selection, setSelection] = useState<IntersectionSelection | null>(
    null,
  );
  const [report, setReport] = useState<IntersectionReport | null>(null);
  const [panelState, setPanelState] = useState<ReportPanelState>("initial");
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelPendingReport = useCallback(() => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  // Unmount guard: composes with the AbortController below — an in-flight
  // fetch must not resolve into setReport/setPanelState after the tree is
  // gone, and it must not keep a live Socrata call running past unmount.
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

  const handleGenerate = useCallback(async () => {
    if (!selection) {
      setReport(null);
      setPanelState("validation-error");
      return;
    }

    cancelPendingReport();
    const requestId = requestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = createReportRequestSignal(controller);
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
        signal,
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
      // Fires for both a genuine network/timeout failure and an abort
      // triggered by `cancelPendingReport` (supersede/unmount). The
      // requestId guard below is what tells them apart: a supersede has
      // already bumped requestIdRef.current, so only a real timeout or
      // network error — where requestId is still current — reaches the
      // source-failure state below it.
      if (requestId !== requestIdRef.current) return;
      setReport(null);
      setPanelState("source-failure");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
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
