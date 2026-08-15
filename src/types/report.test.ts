import { describe, expect, expectTypeOf, it } from "vitest";
import {
  e42AtParkAveReportMock,
  partialSourceReportMock,
  w40At5AveReportMock,
  zeroMatchReportMock,
} from "../lib/mocks/report.mock";
import type { IntersectionReport, IntersectionReportRequest } from "./report";

const DATASET_IDS = ["h9gi-nx95", "inkn-q76z", "qzji-nvbd"];

const reportMocks = [
  w40At5AveReportMock,
  e42AtParkAveReportMock,
  partialSourceReportMock,
  zeroMatchReportMock,
];

function expectLockedReportScope(report: IntersectionReport) {
  expect(report.schemaVersion).toBe("1");
  expect(report.selection.kind).toBe("intersection");
  expect(report.boundary.radiusMeters).toBe(50);
  expect(report.period).toMatchObject({
    startInclusive: "2025-01-01",
    endExclusive: "2026-01-01",
  });
}

function expectRealDatasetIds(report: IntersectionReport) {
  expect(report.sources.map(({ datasetId }) => datasetId).sort()).toEqual(
    DATASET_IDS,
  );
}

describe("intersection report contract", () => {
  it("locks the request discriminants, boundary, and 2025 period", () => {
    expectTypeOf<
      IntersectionReportRequest["schemaVersion"]
    >().toEqualTypeOf<"1">();
    expectTypeOf<
      IntersectionReportRequest["selection"]["kind"]
    >().toEqualTypeOf<"intersection">();
    expectTypeOf<
      IntersectionReportRequest["boundary"]["radiusMeters"]
    >().toEqualTypeOf<50>();
    expectTypeOf<
      IntersectionReportRequest["period"]["startInclusive"]
    >().toEqualTypeOf<"2025-01-01">();
    expectTypeOf<
      IntersectionReportRequest["period"]["endExclusive"]
    >().toEqualTypeOf<"2026-01-01">();
  });

  it("keeps computed metrics and factor results nullable", () => {
    expectTypeOf<IntersectionReport["metrics"]["crashes"]>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<
      IntersectionReport["metrics"]["peopleInjured"]
    >().toEqualTypeOf<number | null>();
    expectTypeOf<
      IntersectionReport["metrics"]["contributingFactors"]
    >().toEqualTypeOf<Array<{ factor: string; count: number }> | null>();
    expectTypeOf<
      IntersectionReport["metrics"]["unspecifiedFactors"]
    >().toEqualTypeOf<number | null>();
  });

  it("exports contract-compatible fixtures with the locked report scope", () => {
    reportMocks.forEach((report) => {
      expectTypeOf(report).toMatchTypeOf<IntersectionReport>();
      expectLockedReportScope(report);
      expectRealDatasetIds(report);
    });
  });
});

describe("documented report fixtures", () => {
  it("uses the exact documented W 40 ST at 5 AVE metrics", () => {
    expect(w40At5AveReportMock.selection.displayName).toBe("W 40 ST at 5 AVE");
    expect(w40At5AveReportMock.metrics).toMatchObject({
      crashes: 6,
      peopleInjured: 7,
      peopleKilled: 1,
      pedestriansInjured: 4,
      pedestriansKilled: 1,
      cyclistsInjured: 1,
      cyclistsKilled: 0,
      motoristsInjured: 2,
      motoristsKilled: 0,
    });
  });

  it("uses only documented E 42 ST at PARK AVE metrics", () => {
    expect(e42AtParkAveReportMock.selection.displayName).toBe(
      "E 42 ST at PARK AVE",
    );
    expect(e42AtParkAveReportMock.metrics).toMatchObject({
      crashes: 9,
      peopleInjured: 4,
      peopleKilled: 0,
      pedestriansInjured: 2,
      pedestriansKilled: null,
      cyclistsInjured: 2,
      cyclistsKilled: null,
      motoristsInjured: null,
      motoristsKilled: null,
      contributingFactors: null,
      unspecifiedFactors: null,
    });
    expect(e42AtParkAveReportMock.limitations).toContain(
      "3 of 9 crash records are missing on_street_name.",
    );
  });
});

describe("honest missing-data semantics", () => {
  it("uses nulls and names the unavailable source in a partial report", () => {
    expect(partialSourceReportMock.status).toBe("partial");
    expect(partialSourceReportMock.metrics).toMatchObject({
      crashes: null,
      peopleInjured: null,
      peopleKilled: null,
      pedestriansInjured: null,
      pedestriansKilled: null,
      cyclistsInjured: null,
      cyclistsKilled: null,
      motoristsInjured: null,
      motoristsKilled: null,
      contributingFactors: null,
      unspecifiedFactors: null,
    });

    const unavailableCollisionSource = partialSourceReportMock.sources.find(
      ({ datasetId }) => datasetId === "h9gi-nx95",
    );
    expect(unavailableCollisionSource).toMatchObject({
      name: "Motor Vehicle Collisions - Crashes",
      datasetId: "h9gi-nx95",
      retrievalStatus: "unavailable",
      retrievedAt: null,
    });
    expect(partialSourceReportMock.limitations.join(" ")).toContain(
      "Motor Vehicle Collisions - Crashes",
    );
  });

  it("distinguishes a successful zero-row result from missing data", () => {
    expect(zeroMatchReportMock.metrics).toMatchObject({
      crashes: 0,
      peopleInjured: 0,
      peopleKilled: 0,
      pedestriansInjured: 0,
      pedestriansKilled: 0,
      cyclistsInjured: 0,
      cyclistsKilled: 0,
      motoristsInjured: 0,
      motoristsKilled: 0,
      contributingFactors: [],
      unspecifiedFactors: 0,
    });

    if (
      "summary" in zeroMatchReportMock &&
      typeof zeroMatchReportMock.summary === "string"
    ) {
      expect(zeroMatchReportMock.summary).toContain(
        "No reported crashes matched this boundary and period",
      );
      expect(zeroMatchReportMock.summary).not.toMatch(/\bsafe(?:ty)?\b/i);
    }
  });
});
