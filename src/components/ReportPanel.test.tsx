import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  e42AtParkAveReportMock,
  partialSourceReportMock,
  w40At5AveReportMock,
  zeroMatchReportMock,
} from "../lib/mocks/report.mock";
import type {
  IntersectionReport,
  IntersectionSelection,
  PriorityZoneStatus,
} from "../types/report";
import ReportPanel from "./ReportPanel";

type PanelState =
  | "initial"
  | "ready"
  | "loading"
  | "complete"
  | "partial"
  | "zero-match"
  | "validation-error"
  | "source-failure";

const selection = w40At5AveReportMock.selection;

const completeReport = {
  ...w40At5AveReportMock,
  status: "complete",
  metrics: {
    ...w40At5AveReportMock.metrics,
    contributingFactors: [
      { factor: "Driver Inattention/Distraction", count: 2 },
    ],
    unspecifiedFactors: 1,
  },
  priorityZone: { status: "matched" },
  limitations: [],
} satisfies IntersectionReport;

function renderPanel({
  state,
  selected = selection,
  report = null,
  onGenerate = vi.fn(),
  onRetry = vi.fn(),
  onClearSelection = vi.fn(),
}: {
  state: PanelState;
  selected?: IntersectionSelection | null;
  report?: IntersectionReport | null;
  onGenerate?: () => void;
  onRetry?: () => void;
  onClearSelection?: () => void;
}) {
  render(
    <ReportPanel
      state={state}
      selection={selected}
      report={report}
      onGenerate={onGenerate}
      onRetry={onRetry}
      onClearSelection={onClearSelection}
    />,
  );
}

function expectMetric(label: string, value: string | number) {
  const term = screen.getByText(label, { selector: "dt" });
  expect(term.nextElementSibling).toHaveTextContent(String(value));
}

describe("ReportPanel controlled states", () => {
  it("renders the initial state", () => {
    renderPanel({ state: "initial", selected: null });

    expect(
      screen.getByText(/select an intersection to create a safety report/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate safety report/i }),
    ).toBeDisabled();
  });

  it("renders the ready state and delegates generate and clear actions", () => {
    const onGenerate = vi.fn();
    const onClearSelection = vi.fn();
    renderPanel({ state: "ready", onGenerate, onClearSelection });

    expect(screen.getByText("W 40 ST at 5 AVE")).toBeInTheDocument();
    expect(screen.getByText("50 meters (about 164 feet)")).toBeInTheDocument();
    expect(screen.getByText("Calendar year 2025")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /generate safety report/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /clear selection/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it("renders the loading state without allowing a duplicate request", () => {
    renderPanel({ state: "loading" });

    expect(screen.getByRole("status")).toHaveTextContent(
      /retrieving NYC Open Data/i,
    );
    expect(
      screen.getByRole("button", { name: /generating safety report/i }),
    ).toBeDisabled();
  });

  it("renders a complete state with a non-color status indicator", () => {
    renderPanel({ state: "complete", report: completeReport });

    const status = screen.getByText("Complete report");
    expect(status).toBeInTheDocument();
    expect(
      status.parentElement?.querySelector('[aria-hidden="true"]'),
    ).not.toBe(null);
  });

  it("renders the exact partial-state warning", () => {
    renderPanel({ state: "partial", report: w40At5AveReportMock });

    expect(screen.getByText("Partial report")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Some required data was unavailable. Available facts are shown below.",
      ),
    ).toBeInTheDocument();
  });

  it("renders a neutral zero-match state and keeps partial limitations", () => {
    renderPanel({ state: "zero-match", report: zeroMatchReportMock });

    expect(
      screen.getByText("No reported crashes matched this boundary and period."),
    ).toBeInTheDocument();
    expectMetric("Crashes", 0);
    expect(
      screen.getByText(
        "Priority Zone overlap is not available in this mock scenario.",
      ),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/\b(?:safe|unsafe)\b/i);
  });

  it("renders a validation error without report facts", () => {
    renderPanel({ state: "validation-error", report: null });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /selection could not be analyzed/i,
    );
    expect(
      screen.queryByText(/reported crashes matched/i),
    ).not.toBeInTheDocument();
  });

  it("renders a retryable source failure and never treats it as zero", () => {
    const onRetry = vi.fn();
    renderPanel({
      state: "source-failure",
      report: partialSourceReportMock,
      onRetry,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /required data could not be loaded/i,
    );
    expect(
      screen.queryByText(/no reported crashes matched/i),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("ReportPanel shared report rendering", () => {
  it("renders the full hierarchy and exact W 40 ST fixture values", () => {
    renderPanel({ state: "partial", report: w40At5AveReportMock });

    expect(
      screen.getByRole("heading", { name: "W 40 ST at 5 AVE" }),
    ).toBeInTheDocument();
    expect(screen.getByText("50 meters (about 164 feet)")).toBeInTheDocument();
    expect(screen.getByText("Calendar year 2025")).toBeInTheDocument();
    expect(screen.getByText("2026-08-15T16:00:00.000Z")).toBeInTheDocument();
    expectMetric("Crashes", 6);
    expectMetric("People injured", 7);
    expectMetric("People killed", 1);
    expectMetric("Pedestrians injured", 4);
    expectMetric("Pedestrians killed", 1);
    expectMetric("Cyclists injured", 1);
    expectMetric("Cyclists killed", 0);
    expectMetric("Motorists injured", 2);
    expectMetric("Motorists killed", 0);
    expectMetric("Contributing factors", "Unavailable");
    expectMetric("Unspecified", "Unavailable");
  });

  it("renders exact E 42 ST values and null metrics as Unavailable", () => {
    renderPanel({ state: "partial", report: e42AtParkAveReportMock });

    expectMetric("Crashes", 9);
    expectMetric("People injured", 4);
    expectMetric("People killed", 0);
    expectMetric("Pedestrians injured", 2);
    expectMetric("Pedestrians killed", "Unavailable");
    expectMetric("Cyclists injured", 2);
    expectMetric("Cyclists killed", "Unavailable");
    expectMetric("Motorists injured", "Unavailable");
    expectMetric("Motorists killed", "Unavailable");
    expect(
      screen.getByText("3 of 9 crash records are missing on_street_name."),
    ).toBeInTheDocument();
  });

  it("renders factors from the report and keeps Unspecified separate", () => {
    renderPanel({ state: "complete", report: completeReport });

    expect(
      screen.getByText("Driver Inattention/Distraction"),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expectMetric("Unspecified", 1);
  });

  it("distinguishes an empty factor result from an unavailable result", () => {
    const { rerender } = render(
      <ReportPanel
        state="zero-match"
        selection={selection}
        report={zeroMatchReportMock}
        onGenerate={vi.fn()}
        onRetry={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/no contributing factors were reported/i),
    ).toBeInTheDocument();

    rerender(
      <ReportPanel
        state="partial"
        selection={selection}
        report={partialSourceReportMock}
        onGenerate={vi.fn()}
        onRetry={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expectMetric("Contributing factors", "Unavailable");
    expect(
      screen.queryByText(/no contributing factors were reported/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "No reported crashes matched this boundary and period.",
      ),
    ).not.toBeInTheDocument();
  });

  it.each<[PriorityZoneStatus, string]>([
    ["matched", "Matched"],
    ["not_matched", "Not matched"],
    ["unavailable", "Unavailable"],
  ])("renders Priority Zone status %s as %s", (status, label) => {
    const report = {
      ...completeReport,
      priorityZone: { status },
    } satisfies IntersectionReport;
    renderPanel({ state: "complete", report });

    const section = screen.getByRole("region", { name: /priority zone/i });
    expect(within(section).getByText(label)).toBeInTheDocument();
  });

  it("renders source provenance without changing links or metadata", () => {
    renderPanel({ state: "partial", report: w40At5AveReportMock });

    for (const source of w40At5AveReportMock.sources) {
      const link = screen.getByRole("link", { name: source.name });
      expect(link).toHaveAttribute("href", source.url);
      const sourceItem = link.closest("li");
      expect(sourceItem).not.toBeNull();
      expect(sourceItem).toHaveTextContent(source.datasetId);
      expect(sourceItem).toHaveTextContent(source.role);
      expect(sourceItem).toHaveTextContent(source.retrievalStatus);
      expect(sourceItem).toHaveTextContent(source.queryDescription);
      if (source.retrievedAt) {
        expect(sourceItem).toHaveTextContent(source.retrievedAt);
      }
    }
  });

  it("prints the exact same report object once through the browser", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderPanel({ state: "partial", report: w40At5AveReportMock });

    fireEvent.click(
      screen.getByRole("button", { name: "Print or save as PDF" }),
    );

    expect(print).toHaveBeenCalledOnce();
    const printable = screen.getByRole("article", {
      name: "Printable safety report",
    });
    expect(
      within(printable).getByRole("heading", { name: "W 40 ST at 5 AVE" }),
    ).toBeInTheDocument();
    const crashes = within(printable).getByText("Crashes", { selector: "dt" });
    expect(crashes.nextElementSibling).toHaveTextContent("6");
    expect(within(printable).getByText("Partial report")).toBeInTheDocument();
    expect(
      within(printable).getByText(
        "Priority Zone overlap is not available in the documented fixture.",
      ),
    ).toBeInTheDocument();
  });
});
