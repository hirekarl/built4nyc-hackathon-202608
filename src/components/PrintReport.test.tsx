import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  e42AtParkAveReportMock,
  partialSourceReportMock,
  w40At5AveReportMock,
  zeroMatchReportMock,
} from "../lib/mocks/report.mock";
import type { IntersectionReport } from "../types/report";
import PrintReport from "./PrintReport";

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

function printableReport() {
  return screen.getByRole("article", { name: "Printable safety report" });
}

function expectPrintMetric(label: string, value: string | number) {
  const report = printableReport();
  const term = within(report).getByText(label, { selector: "dt" });
  expect(term.nextElementSibling).toHaveTextContent(String(value));
}

describe("PrintReport", () => {
  it("renders a complete report from the supplied object without changing facts", () => {
    render(<PrintReport report={completeReport} />);
    const report = printableReport();

    expect(
      within(report).getByRole("heading", { name: "W 40 ST at 5 AVE" }),
    ).toBeInTheDocument();
    expect(within(report).getByText("Complete report")).toBeInTheDocument();
    expect(
      within(report).getByText("50 meters (about 164 feet)"),
    ).toBeInTheDocument();
    expect(within(report).getByText("Calendar year 2025")).toBeInTheDocument();
    expect(
      within(report).getByText("2026-08-15T16:00:00.000Z"),
    ).toBeInTheDocument();
    expectPrintMetric("Crashes", 6);
    expectPrintMetric("People injured", 7);
    expectPrintMetric("People killed", 1);
    expect(
      within(report).getByText("Driver Inattention/Distraction"),
    ).toBeInTheDocument();
    expectPrintMetric("Unspecified", 1);
    expect(within(report).getByText("Matched")).toBeInTheDocument();
  });

  it("renders the exact partial fixture, limitations, and source provenance", () => {
    render(<PrintReport report={w40At5AveReportMock} />);
    const report = printableReport();

    expect(within(report).getByText("Partial report")).toBeInTheDocument();
    expectPrintMetric("Crashes", 6);
    for (const limitation of w40At5AveReportMock.limitations) {
      expect(within(report).getByText(limitation)).toBeInTheDocument();
    }
    for (const source of w40At5AveReportMock.sources) {
      const link = within(report).getByRole("link", { name: source.name });
      expect(link).toHaveAttribute("href", source.url);
      expect(link.closest("li")).toHaveTextContent(source.datasetId);
      expect(link.closest("li")).toHaveTextContent(source.retrievalStatus);
      expect(link.closest("li")).toHaveTextContent(source.queryDescription);
    }
  });

  it("renders missing values as Unavailable and never as zero", () => {
    render(<PrintReport report={e42AtParkAveReportMock} />);

    expectPrintMetric("Pedestrians killed", "Unavailable");
    expectPrintMetric("Cyclists killed", "Unavailable");
    expectPrintMetric("Motorists injured", "Unavailable");
    expectPrintMetric("Motorists killed", "Unavailable");
    expectPrintMetric("Contributing factors", "Unavailable");
    expectPrintMetric("Unspecified", "Unavailable");
  });

  it("prints successful zeroes with neutral wording and an empty factor result", () => {
    render(<PrintReport report={zeroMatchReportMock} />);
    const report = printableReport();

    expect(
      within(report).getByText(
        "No reported crashes matched this boundary and period.",
      ),
    ).toBeInTheDocument();
    expectPrintMetric("Crashes", 0);
    expectPrintMetric("People injured", 0);
    expectPrintMetric("People killed", 0);
    expect(
      within(report).getByText(/no contributing factors were reported/i),
    ).toBeInTheDocument();
    expect(report).not.toHaveTextContent(/\b(?:safe|unsafe)\b/i);
  });

  it("retains partial status, limitations, and unavailable sources", () => {
    render(<PrintReport report={partialSourceReportMock} />);
    const report = printableReport();

    expect(within(report).getByText("Partial report")).toBeInTheDocument();
    expectPrintMetric("Crashes", "Unavailable");
    for (const limitation of partialSourceReportMock.limitations) {
      expect(within(report).getByText(limitation)).toBeInTheDocument();
    }
    const unavailableSources = partialSourceReportMock.sources.filter(
      ({ retrievalStatus }) => retrievalStatus === "unavailable",
    );
    for (const source of unavailableSources) {
      const item = within(report)
        .getByRole("link", { name: source.name })
        .closest("li");
      expect(item).toHaveTextContent("unavailable");
      expect(item).toHaveTextContent("Unavailable");
    }
  });
});
