/**
 * TDD red for Phase 2 Step 2.5 — deterministic collision-metrics aggregation.
 *
 * This test file specifies the API surface `builder` must implement in
 * `src/lib/report.ts`:
 *
 * - `aggregateCollisionMetrics(rows: CollisionRow[]): IntersectionReportMetrics`
 *     Pure, deterministic reduction of Step 2.4's raw `CollisionRow[]` into
 *     the frozen `IntersectionReportMetrics` shape (`src/types/report.ts`).
 *     Never throws. Never depends on `Date`, randomness, or any wall-clock
 *     value — the `generatedAt` timestamp is a separate concern added in
 *     Step 2.7, not this function's job.
 *
 * DOCUMENTED DECISIONS (per docs/contract.md's "Completeness and
 * missing-data semantics" and the PRD's null-vs-zero rule):
 *
 * 1. MALFORMED-VALUE PROPAGATION — if ANY row's numeric field for a given
 *    metric (e.g. `number_of_persons_injured`) is malformed (non-numeric,
 *    empty string, negative, `null`, or `undefined`), that metric becomes
 *    `null` for the WHOLE aggregate. A malformed value is never silently
 *    excluded (which would understate a partial sum) and never coerced to
 *    `0`. Other metrics computed from clean fields in the same rows remain
 *    correctly computed numbers — nulling is per-metric, not all-or-nothing
 *    across the whole `IntersectionReportMetrics` object. This mirrors the
 *    mixed null/number shape documented in
 *    `src/lib/mocks/report.mock.ts`'s `e42AtParkAveReportMock`.
 *
 * 2. NULL VS. `""` VS. MISSING for numeric fields — absent (`undefined`),
 *    explicit `null`, and empty string (`""`) are all treated as missing
 *    data for that field, which (per decision 1) nulls the whole metric.
 *    None of these are ever treated as `0`. A negative numeric string
 *    (e.g. `"-1"`) is also treated as malformed (nulls the metric), since a
 *    real casualty count cannot be negative.
 *
 * 3. "UNSPECIFIED" VS. "NO FACTOR RECORDED" — `"Unspecified"` is a real
 *    value NYPD writes into `contributing_factor_vehicle_N` and is counted
 *    in `unspecifiedFactors`. A row where ALL FIVE `contributing_factor_
 *    vehicle_1..5` fields are blank/absent recorded NOTHING and is EXCLUDED
 *    from the rollup entirely — it is not counted as `"Unspecified"` and
 *    does not appear in `contributingFactors`. Conflating "police wrote
 *    Unspecified" with "no data was recorded at all" would misrepresent the
 *    source. The row is still counted in `crashes` and every additive
 *    injury/fatality metric — only the factor rollup treats it as absent.
 *
 * 4. RANKING RULE — `contributingFactors` is sorted descending by `count`;
 *    ties are broken alphabetically (ascending, `String#localeCompare`-free
 *    plain `<` ordering) by `factor` label, so output is fully deterministic
 *    regardless of row iteration order.
 *
 * 5. `"Unspecified"` NEVER appears inside the ranked `contributingFactors`
 *    array — it is tracked ONLY via the separate `unspecifiedFactors` count,
 *    per the knowledge base's "keep Unspecified factors separate from
 *    ranked named factors" guidance.
 *
 * Zero-rows input is a SUCCESSFUL empty result, not missing data: every
 * numeric metric is `0` (never `null`), `contributingFactors` is `[]`
 * (never `null`), and `unspecifiedFactors` is `0` (never `null`).
 */

import { describe, expect, it } from "vitest";
import {
  aggregateCollisionMetrics,
  assembleIntersectionReport,
} from "./report";
import type { CollisionFetchResult, CollisionRow } from "./adapters/collisions";
import type { ResolvedIntersection } from "./adapters/centerline";
import type {
  IntersectionReport,
  IntersectionReportMetrics,
  ReportSource,
} from "../types/report";

function collisionRow(overrides: Partial<CollisionRow> = {}): CollisionRow {
  return {
    crash_date: "2025-03-14T00:00:00.000",
    crash_time: "8:15",
    borough: "MANHATTAN",
    zip_code: "10018",
    latitude: "40.7522",
    longitude: "-73.9818",
    location: {
      latitude: "40.7522",
      longitude: "-73.9818",
    },
    on_street_name: "W 40 ST",
    off_street_name: "5 AVE",
    cross_street_name: null,
    number_of_persons_injured: "0",
    number_of_persons_killed: "0",
    number_of_pedestrians_injured: "0",
    number_of_pedestrians_killed: "0",
    number_of_cyclist_injured: "0",
    number_of_cyclist_killed: "0",
    number_of_motorist_injured: "0",
    number_of_motorist_killed: "0",
    contributing_factor_vehicle_1: null,
    contributing_factor_vehicle_2: null,
    contributing_factor_vehicle_3: null,
    contributing_factor_vehicle_4: null,
    contributing_factor_vehicle_5: null,
    collision_id: "4700000",
    vehicle_type_code1: "Sedan",
    vehicle_type_code2: null,
    vehicle_type_code_3: null,
    vehicle_type_code_4: null,
    vehicle_type_code_5: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PRD §12 fixture 1: W 40 ST at 5 AVE
// 6 crashes; 7 people injured, 1 killed; 4 pedestrians injured, 1 killed;
// 1 cyclist injured, 0 killed; 2 motorists injured, 0 killed.
// ---------------------------------------------------------------------------

function w40At5AveFixtureRows(): CollisionRow[] {
  return [
    collisionRow({
      collision_id: "4700001",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
      contributing_factor_vehicle_1: "Driver Inattention/Distraction",
    }),
    collisionRow({
      collision_id: "4700002",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
      contributing_factor_vehicle_1: "Driver Inattention/Distraction",
    }),
    collisionRow({
      collision_id: "4700003",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
      contributing_factor_vehicle_1: "Following Too Closely",
    }),
    collisionRow({
      collision_id: "4700004",
      number_of_persons_injured: "0",
      number_of_persons_killed: "1",
      number_of_pedestrians_injured: "0",
      number_of_pedestrians_killed: "1",
      contributing_factor_vehicle_1: "Driver Inattention/Distraction",
      contributing_factor_vehicle_2: "Unspecified",
    }),
    collisionRow({
      collision_id: "4700005",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
      contributing_factor_vehicle_1: "Unspecified",
    }),
    collisionRow({
      collision_id: "4700006",
      number_of_persons_injured: "3",
      number_of_cyclist_injured: "1",
      number_of_motorist_injured: "2",
      contributing_factor_vehicle_1: "Following Too Closely",
      contributing_factor_vehicle_2: "Unspecified",
    }),
  ];
}

const w40At5AveExpectedMetrics: IntersectionReportMetrics = {
  crashes: 6,
  peopleInjured: 7,
  peopleKilled: 1,
  pedestriansInjured: 4,
  pedestriansKilled: 1,
  cyclistsInjured: 1,
  cyclistsKilled: 0,
  motoristsInjured: 2,
  motoristsKilled: 0,
  contributingFactors: [
    { factor: "Driver Inattention/Distraction", count: 3 },
    { factor: "Following Too Closely", count: 2 },
  ],
  unspecifiedFactors: 3,
};

// ---------------------------------------------------------------------------
// PRD §12 fixture 2: E 42 ST at PARK AVE
// 9 crashes; 4 people injured, 0 killed; 2 pedestrians injured; 2 cyclists
// injured; 3 of 9 rows missing on_street_name (must not drop rows or change
// counts). Also carries a tie in named-factor counts (alphabetical
// tie-break) and two all-blank-factor rows (excluded from the rollup).
// ---------------------------------------------------------------------------

function e42AtParkAveFixtureRows(): CollisionRow[] {
  return [
    collisionRow({
      collision_id: "4800001",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
      contributing_factor_vehicle_1: "Unspecified",
    }),
    collisionRow({
      collision_id: "4800002",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
      contributing_factor_vehicle_1: "Unspecified",
    }),
    collisionRow({
      collision_id: "4800003",
      number_of_persons_injured: "1",
      number_of_cyclist_injured: "1",
      contributing_factor_vehicle_1: "Driver Inattention/Distraction",
    }),
    collisionRow({
      collision_id: "4800004",
      number_of_persons_injured: "1",
      number_of_cyclist_injured: "1",
      // all five factor fields blank -> excluded from the rollup entirely.
    }),
    collisionRow({
      collision_id: "4800005",
      on_street_name: null,
      off_street_name: null,
      cross_street_name: "E 42 ST",
      contributing_factor_vehicle_1: "Unspecified",
    }),
    collisionRow({
      collision_id: "4800006",
      on_street_name: null,
      off_street_name: null,
      cross_street_name: "E 42 ST",
      // all five factor fields blank -> excluded from the rollup entirely.
    }),
    collisionRow({
      collision_id: "4800007",
      on_street_name: null,
      off_street_name: null,
      cross_street_name: "E 42 ST",
      contributing_factor_vehicle_1: "Pavement Slippery",
    }),
    collisionRow({
      collision_id: "4800008",
      contributing_factor_vehicle_1: "Pavement Slippery",
    }),
    collisionRow({
      collision_id: "4800009",
      contributing_factor_vehicle_1: "Driver Inattention/Distraction",
    }),
  ];
}

const e42AtParkAveExpectedMetrics: IntersectionReportMetrics = {
  crashes: 9,
  peopleInjured: 4,
  peopleKilled: 0,
  pedestriansInjured: 2,
  pedestriansKilled: 0,
  cyclistsInjured: 2,
  cyclistsKilled: 0,
  motoristsInjured: 0,
  motoristsKilled: 0,
  contributingFactors: [
    { factor: "Driver Inattention/Distraction", count: 2 },
    { factor: "Pavement Slippery", count: 2 },
  ],
  unspecifiedFactors: 3,
};

describe("aggregateCollisionMetrics — PRD §12 fixtures", () => {
  it("reproduces the W 40 ST at 5 AVE fixture exactly", () => {
    const result = aggregateCollisionMetrics(w40At5AveFixtureRows());
    expect(result).toEqual(w40At5AveExpectedMetrics);
  });

  it("reproduces the E 42 ST at PARK AVE fixture exactly, and missing on_street_name never drops rows or changes counts", () => {
    const rows = e42AtParkAveFixtureRows();
    const missingLabelRows = rows.filter((row) => !row.on_street_name);
    expect(missingLabelRows).toHaveLength(3);

    const result = aggregateCollisionMetrics(rows);
    expect(result).toEqual(e42AtParkAveExpectedMetrics);
    expect(result.crashes).toBe(9);
  });
});

describe("aggregateCollisionMetrics — zero rows is a successful zero, not missing data", () => {
  it("returns all-zero numeric metrics, an empty contributingFactors array, and 0 unspecifiedFactors for zero input rows", () => {
    const result = aggregateCollisionMetrics([]);

    const numericMetricKeys: Array<keyof IntersectionReportMetrics> = [
      "crashes",
      "peopleInjured",
      "peopleKilled",
      "pedestriansInjured",
      "pedestriansKilled",
      "cyclistsInjured",
      "cyclistsKilled",
      "motoristsInjured",
      "motoristsKilled",
      "unspecifiedFactors",
    ];
    for (const key of numericMetricKeys) {
      expect(result[key]).not.toBeNull();
      expect(result[key]).toBe(0);
    }

    expect(result.contributingFactors).not.toBeNull();
    expect(result.contributingFactors).toEqual([]);
  });
});

describe("aggregateCollisionMetrics — malformed numeric propagation (null, never 0, per-metric only)", () => {
  it("nulls peopleInjured for a non-numeric value ('abc') while leaving peopleKilled computed", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({
        number_of_persons_injured: "abc",
        number_of_persons_killed: "1",
      }),
    ]);
    expect(result.peopleInjured).toBeNull();
    expect(result.peopleKilled).toBe(1);
  });

  it("nulls peopleInjured for an empty string ('')", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({ number_of_persons_injured: "" }),
    ]);
    expect(result.peopleInjured).toBeNull();
  });

  it("nulls peopleInjured for a whitespace-only string (' ') — Number(' ') is 0, which would fabricate a safety metric", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({ number_of_persons_injured: " " }),
    ]);
    expect(result.peopleInjured).not.toBe(0);
    expect(result.peopleInjured).toBeNull();
  });

  it("nulls peopleInjured for a tab/newline-only string", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({ number_of_persons_injured: "\t\n" }),
    ]);
    expect(result.peopleInjured).toBeNull();
  });

  it("nulls peopleInjured for an explicit null value", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({ number_of_persons_injured: null }),
    ]);
    expect(result.peopleInjured).toBeNull();
  });

  it("nulls peopleInjured for an undefined (absent) field", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({ number_of_persons_injured: undefined }),
    ]);
    expect(result.peopleInjured).toBeNull();
  });

  it("nulls peopleInjured for a negative numeric string ('-1') — a real casualty count cannot be negative", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({ number_of_persons_injured: "-1" }),
    ]);
    expect(result.peopleInjured).toBeNull();
  });

  it("never silently coerces a malformed value to the number 0", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({ number_of_persons_injured: "abc" }),
    ]);
    expect(result.peopleInjured).not.toBe(0);
    expect(result.peopleInjured).toBeNull();
  });

  it("nulls only the affected metric across multiple rows, leaving unrelated metrics correctly computed (mixed null/number shape)", () => {
    const rows: CollisionRow[] = [
      collisionRow({
        collision_id: "4700099",
        number_of_persons_injured: "2",
        number_of_persons_killed: "0",
        number_of_pedestrians_injured: "1",
        number_of_pedestrians_killed: "abc", // malformed -> pedestriansKilled null
        number_of_cyclist_injured: "1",
        number_of_cyclist_killed: "", // malformed -> cyclistsKilled null
        number_of_motorist_injured: null, // malformed -> motoristsInjured null
        number_of_motorist_killed: undefined, // malformed -> motoristsKilled null
        contributing_factor_vehicle_1: null,
      }),
      collisionRow({
        collision_id: "4700100",
        number_of_persons_injured: "1",
        number_of_persons_killed: "0",
        number_of_pedestrians_injured: "1",
        number_of_pedestrians_killed: "0",
        number_of_cyclist_injured: "0",
        number_of_cyclist_killed: "0",
        number_of_motorist_injured: "0",
        number_of_motorist_killed: "0",
        contributing_factor_vehicle_1: "Unspecified",
      }),
    ];

    const result = aggregateCollisionMetrics(rows);

    expect(result.crashes).toBe(2);
    expect(result.peopleInjured).toBe(3);
    expect(result.peopleKilled).toBe(0);
    expect(result.pedestriansInjured).toBe(2);
    expect(result.pedestriansKilled).toBeNull();
    expect(result.cyclistsInjured).toBe(1);
    expect(result.cyclistsKilled).toBeNull();
    expect(result.motoristsInjured).toBeNull();
    expect(result.motoristsKilled).toBeNull();
    expect(result.contributingFactors).toEqual([]);
    expect(result.unspecifiedFactors).toBe(1);
  });
});

describe("aggregateCollisionMetrics — labels never gate counting", () => {
  it("still counts a row missing every street-name label in crashes and injury metrics", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({
        on_street_name: null,
        off_street_name: null,
        cross_street_name: null,
        number_of_persons_injured: "1",
        number_of_pedestrians_injured: "1",
      }),
    ]);
    expect(result.crashes).toBe(1);
    expect(result.peopleInjured).toBe(1);
    expect(result.pedestriansInjured).toBe(1);
  });
});

describe("aggregateCollisionMetrics — contributing-factor rollup", () => {
  it("counts factors across contributing_factor_vehicle_1..5 within a single row", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({
        contributing_factor_vehicle_1: "Driver Inattention/Distraction",
        contributing_factor_vehicle_2: "Following Too Closely",
        contributing_factor_vehicle_3: "Pavement Slippery",
        contributing_factor_vehicle_4: "Unspecified",
        contributing_factor_vehicle_5: "Unspecified",
      }),
    ]);

    expect(result.contributingFactors).toEqual([
      { factor: "Driver Inattention/Distraction", count: 1 },
      { factor: "Following Too Closely", count: 1 },
      { factor: "Pavement Slippery", count: 1 },
    ]);
    expect(result.unspecifiedFactors).toBe(2);
  });

  it("ranks contributingFactors descending by count, breaking ties alphabetically by factor label", () => {
    const rows: CollisionRow[] = [
      collisionRow({ contributing_factor_vehicle_1: "Pavement Slippery" }),
      collisionRow({ contributing_factor_vehicle_1: "Pavement Slippery" }),
      collisionRow({
        contributing_factor_vehicle_1: "Driver Inattention/Distraction",
      }),
      collisionRow({
        contributing_factor_vehicle_1: "Driver Inattention/Distraction",
      }),
      collisionRow({ contributing_factor_vehicle_1: "Following Too Closely" }),
    ];

    const result = aggregateCollisionMetrics(rows);

    expect(result.contributingFactors).toEqual([
      { factor: "Driver Inattention/Distraction", count: 2 },
      { factor: "Pavement Slippery", count: 2 },
      { factor: "Following Too Closely", count: 1 },
    ]);
  });

  it("treats a row where all five factor fields are blank as recording nothing: excluded from contributingFactors and NOT counted as Unspecified", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({
        contributing_factor_vehicle_1: null,
        contributing_factor_vehicle_2: null,
        contributing_factor_vehicle_3: null,
        contributing_factor_vehicle_4: null,
        contributing_factor_vehicle_5: undefined,
      }),
    ]);

    expect(result.contributingFactors).toEqual([]);
    expect(result.unspecifiedFactors).toBe(0);
    // A row that recorded nothing is still a real crash.
    expect(result.crashes).toBe(1);
  });

  it("treats a row where every factor field is the empty string the same as blank: excluded, not Unspecified", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({
        contributing_factor_vehicle_1: "",
        contributing_factor_vehicle_2: "",
        contributing_factor_vehicle_3: "",
        contributing_factor_vehicle_4: "",
        contributing_factor_vehicle_5: "",
      }),
    ]);

    expect(result.contributingFactors).toEqual([]);
    expect(result.unspecifiedFactors).toBe(0);
  });

  it("never includes 'Unspecified' as an entry inside the ranked contributingFactors array", () => {
    const result = aggregateCollisionMetrics([
      collisionRow({ contributing_factor_vehicle_1: "Unspecified" }),
      collisionRow({ contributing_factor_vehicle_1: "Unspecified" }),
      collisionRow({ contributing_factor_vehicle_1: "Unspecified" }),
    ]);

    expect(
      result.contributingFactors?.some(
        (entry: { factor: string; count: number }) =>
          entry.factor === "Unspecified",
      ),
    ).toBe(false);
    expect(result.unspecifiedFactors).toBe(3);
  });
});

describe("aggregateCollisionMetrics — purity and determinism", () => {
  it("returns deeply equal results across repeated calls with the same input", () => {
    const rows = w40At5AveFixtureRows();

    const first = aggregateCollisionMetrics(rows);
    const second = aggregateCollisionMetrics(rows);

    expect(first).toEqual(second);
  });

  it("does not mutate the input rows", () => {
    const rows = e42AtParkAveFixtureRows();
    const snapshot = JSON.parse(JSON.stringify(rows)) as unknown;

    aggregateCollisionMetrics(rows);

    expect(JSON.parse(JSON.stringify(rows))).toEqual(snapshot);
  });
});

/**
 * TDD red for Phase 2 Step 2.7 — full report assembly.
 *
 * This block specifies the API surface `builder` must add to
 * `src/lib/report.ts`:
 *
 *   export function assembleIntersectionReport(input: {
 *     selection: ResolvedIntersection;
 *     collisions: CollisionFetchResult;
 *     priorityZone: PriorityZoneResult;
 *     generatedAt: string; // injected, never read from Date internally
 *     reportId: string;    // injected, never generated internally
 *   }): IntersectionReport
 *
 * Pure and deterministic: same input -> deeply equal output, no wall-clock
 * or randomness read inside the function (mirrors the purity requirement
 * already enforced on `aggregateCollisionMetrics`).
 *
 * DOCUMENTED ASSEMBLY RULES this test file pins down (continuing the exact
 * conventions already shown in `src/lib/mocks/report.mock.ts`, which the
 * frontend already renders against):
 *
 * 1. STATUS — "complete" only when collisions.status === "available" AND
 *    priorityZone.status !== "unavailable"; otherwise "partial". Both
 *    sources degrading simultaneously still yields exactly one "partial"
 *    status (never a compounded/duplicated state), carrying every
 *    applicable limitation.
 *
 * 2. METRICS — collisions.status === "available" -> metrics =
 *    aggregateCollisionMetrics(collisions.rows). collisions.status ===
 *    "unavailable" -> every metric field is `null` (never `0`).
 *
 * 3. SUMMARY (deterministic, matches the exact wording already used in the
 *    Phase 1 mocks):
 *    - collisions unavailable ->
 *        "Crash metrics are unavailable because a required source could not be retrieved."
 *    - collisions available, crashes === 0 ->
 *        "No reported crashes matched this boundary and period."
 *    - collisions available, crashes > 0 ->
 *        `${crashes} reported crashes matched this boundary and period.`
 *    The summary NEVER contains the word "safe" — a zero or low count is a
 *    neutral result, never a safety claim (docs/contract.md).
 *
 * 4. PRIORITY ZONE ECHO — priorityZone.status is copied through verbatim
 *    into `priorityZone.status` on the report ("matched" | "not_matched" |
 *    "unavailable").
 *
 * 5. LIMITATIONS (exact strings, matching the Phase 1 mocks verbatim so the
 *    already-implemented frontend renders identical copy):
 *    - collisions unavailable ->
 *        "Motor Vehicle Collisions - Crashes is unavailable, so collision metrics could not be computed."
 *    - priorityZone unavailable ->
 *        "VZV Priority Zones or Areas is unavailable, so boundary overlap could not be checked."
 *    - data quality: when collisions are available and some (but not all)
 *      matched rows are missing `on_street_name`, add
 *        `${missingCount} of ${totalCount} crash records are missing on_street_name.`
 *      Coordinate-based counts are NOT suppressed by this — see rule 6.
 *
 * 6. NOTES — when the data-quality limitation above fires, `notes` includes
 *    exactly:
 *      "The matched crash records had coordinates, so missing street labels do not change the coordinate-based counts."
 *    Otherwise `notes` is `[]`.
 *
 * 7. SOURCES — always exactly 3 entries, in this order, with the real
 *    dataset IDs (never a placeholder):
 *      [0] name "NYC Street Centerline", datasetId "inkn-q76z",
 *          url "https://data.cityofnewyork.us/City-Government/Centerline/3mf9-qshr",
 *          role "selection_geometry", retrievalStatus "available" (the
 *          assembler only runs after a successful centerline resolution),
 *          retrievedAt = the injected `generatedAt`,
 *          queryDescription "Eligible street geometry is loaded by map viewport."
 *      [1] name "Motor Vehicle Collisions - Crashes", datasetId "h9gi-nx95",
 *          url "https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95",
 *          role "collision_metrics", retrievalStatus = collisions.status,
 *          retrievedAt = collisions.retrievedAt when available, else null,
 *          queryDescription "Crash records are queried within 50 meters for calendar year 2025."
 *      [2] name "VZV Priority Zones or Areas", datasetId "qzji-nvbd",
 *          url "https://data.cityofnewyork.us/Transportation/VZV-Priority-Zones-or-Areas/qzji-nvbd",
 *          role "priority_context", retrievalStatus "available" unless
 *          priorityZone.status === "unavailable", retrievedAt = the injected
 *          `generatedAt` when available else null,
 *          queryDescription "Five multipolygons are fetched and checked for boundary overlap."
 */

const ASSEMBLY_GENERATED_AT = "2026-08-15T16:00:00.000Z";
const ASSEMBLY_COLLISION_RETRIEVED_AT = "2026-08-15T15:59:00.000Z";
const ASSEMBLY_REPORT_ID = "report-assembly-test-2025";

const w40SelectionFixture: ResolvedIntersection = {
  displayName: "W 40 ST at 5 AVE",
  coordinate: { latitude: 40.752205375223, longitude: -73.981823738617 },
  streetNames: ["W 40 ST", "5 AVE"],
  physicalIds: ["183093"],
};

const e42SelectionFixture: ResolvedIntersection = {
  displayName: "E 42 ST at PARK AVE",
  coordinate: { latitude: 40.752175843845, longitude: -73.977792815236 },
  streetNames: ["E 42 ST", "PARK AVE"],
  physicalIds: ["73419", "148625"],
};

const CENTERLINE_SOURCE = {
  name: "NYC Street Centerline",
  datasetId: "inkn-q76z",
  url: "https://data.cityofnewyork.us/City-Government/Centerline/3mf9-qshr",
  role: "selection_geometry",
  queryDescription: "Eligible street geometry is loaded by map viewport.",
} as const;

const COLLISION_SOURCE_BASE = {
  name: "Motor Vehicle Collisions - Crashes",
  datasetId: "h9gi-nx95",
  url: "https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95",
  role: "collision_metrics",
  queryDescription:
    "Crash records are queried within 50 meters for calendar year 2025.",
} as const;

const PRIORITY_ZONE_SOURCE_BASE = {
  name: "VZV Priority Zones or Areas",
  datasetId: "qzji-nvbd",
  url: "https://data.cityofnewyork.us/Transportation/VZV-Priority-Zones-or-Areas/qzji-nvbd",
  role: "priority_context",
  queryDescription:
    "Five multipolygons are fetched and checked for boundary overlap.",
} as const;

const COLLISION_UNAVAILABLE_LIMITATION =
  "Motor Vehicle Collisions - Crashes is unavailable, so collision metrics could not be computed.";
const PRIORITY_ZONE_UNAVAILABLE_LIMITATION =
  "VZV Priority Zones or Areas is unavailable, so boundary overlap could not be checked.";
const ON_STREET_NAME_NOTE =
  "The matched crash records had coordinates, so missing street labels do not change the coordinate-based counts.";

function availableCollisions(rows: CollisionRow[]): CollisionFetchResult {
  return {
    status: "available",
    rows,
    retrievedAt: ASSEMBLY_COLLISION_RETRIEVED_AT,
  };
}

function unavailableCollisions(): CollisionFetchResult {
  return {
    status: "unavailable",
    reason: "timeout",
    retrievedAt: ASSEMBLY_COLLISION_RETRIEVED_AT,
  };
}

describe("assembleIntersectionReport — PRD §12 fixtures assembled exactly", () => {
  it("assembles the FULL W 40 ST at 5 AVE report object exactly, with an available Priority Zone", () => {
    const result = assembleIntersectionReport({
      selection: w40SelectionFixture,
      collisions: availableCollisions(w40At5AveFixtureRows()),
      priorityZone: { status: "not_matched" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });

    const expected: IntersectionReport = {
      schemaVersion: "1",
      reportId: ASSEMBLY_REPORT_ID,
      generatedAt: ASSEMBLY_GENERATED_AT,
      status: "complete",
      summary: "6 reported crashes matched this boundary and period.",
      selection: {
        kind: "intersection",
        ...w40SelectionFixture,
      },
      boundary: { kind: "circle", radiusMeters: 50 },
      period: { startInclusive: "2025-01-01", endExclusive: "2026-01-01" },
      metrics: w40At5AveExpectedMetrics,
      priorityZone: { status: "not_matched" },
      limitations: [],
      notes: [],
      sources: [
        {
          ...CENTERLINE_SOURCE,
          retrievalStatus: "available",
          retrievedAt: ASSEMBLY_GENERATED_AT,
        },
        {
          ...COLLISION_SOURCE_BASE,
          retrievalStatus: "available",
          retrievedAt: ASSEMBLY_COLLISION_RETRIEVED_AT,
        },
        {
          ...PRIORITY_ZONE_SOURCE_BASE,
          retrievalStatus: "available",
          retrievedAt: ASSEMBLY_GENERATED_AT,
        },
      ],
    };

    expect(result).toEqual(expected);
  });

  it("assembles the FULL E 42 ST at PARK AVE report object exactly, including the missing-on_street_name limitation and note", () => {
    const result = assembleIntersectionReport({
      selection: e42SelectionFixture,
      collisions: availableCollisions(e42AtParkAveFixtureRows()),
      priorityZone: { status: "matched" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });

    const expected: IntersectionReport = {
      schemaVersion: "1",
      reportId: ASSEMBLY_REPORT_ID,
      generatedAt: ASSEMBLY_GENERATED_AT,
      status: "complete",
      summary: "9 reported crashes matched this boundary and period.",
      selection: {
        kind: "intersection",
        ...e42SelectionFixture,
      },
      boundary: { kind: "circle", radiusMeters: 50 },
      period: { startInclusive: "2025-01-01", endExclusive: "2026-01-01" },
      metrics: e42AtParkAveExpectedMetrics,
      priorityZone: { status: "matched" },
      limitations: ["3 of 9 crash records are missing on_street_name."],
      notes: [ON_STREET_NAME_NOTE],
      sources: [
        {
          ...CENTERLINE_SOURCE,
          retrievalStatus: "available",
          retrievedAt: ASSEMBLY_GENERATED_AT,
        },
        {
          ...COLLISION_SOURCE_BASE,
          retrievalStatus: "available",
          retrievedAt: ASSEMBLY_COLLISION_RETRIEVED_AT,
        },
        {
          ...PRIORITY_ZONE_SOURCE_BASE,
          retrievalStatus: "available",
          retrievedAt: ASSEMBLY_GENERATED_AT,
        },
      ],
    };

    expect(result).toEqual(expected);
  });
});

describe("assembleIntersectionReport — status determination", () => {
  it("is 'complete' only when collisions are available AND priorityZone is not 'unavailable'", () => {
    const matched = assembleIntersectionReport({
      selection: w40SelectionFixture,
      collisions: availableCollisions([]),
      priorityZone: { status: "matched" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });
    expect(matched.status).toBe("complete");

    const notMatched = assembleIntersectionReport({
      selection: w40SelectionFixture,
      collisions: availableCollisions([]),
      priorityZone: { status: "not_matched" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });
    expect(notMatched.status).toBe("complete");
  });

  it("is 'partial' when the collision source is unavailable — all collision metrics are null (never 0), a limitation names the collision source, and its source entry is marked unavailable", () => {
    const result = assembleIntersectionReport({
      selection: w40SelectionFixture,
      collisions: unavailableCollisions(),
      priorityZone: { status: "matched" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });

    expect(result.status).toBe("partial");
    expect(result.metrics).toEqual({
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
    for (const key of Object.values(result.metrics)) {
      expect(key).not.toBe(0);
    }
    expect(result.limitations).toContain(COLLISION_UNAVAILABLE_LIMITATION);

    const collisionSource = result.sources.find(
      (source: ReportSource) => source.role === "collision_metrics",
    );
    expect(collisionSource?.retrievalStatus).toBe("unavailable");
    expect(collisionSource?.retrievedAt).toBeNull();
  });

  it("is 'partial' when the Priority Zone source is unavailable — collision facts remain fully visible and a limitation names the Priority Zone source", () => {
    const result = assembleIntersectionReport({
      selection: w40SelectionFixture,
      collisions: availableCollisions(w40At5AveFixtureRows()),
      priorityZone: { status: "unavailable" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });

    expect(result.status).toBe("partial");
    expect(result.metrics).toEqual(w40At5AveExpectedMetrics);
    expect(result.priorityZone).toEqual({ status: "unavailable" });
    expect(result.limitations).toContain(PRIORITY_ZONE_UNAVAILABLE_LIMITATION);

    const priorityZoneSource = result.sources.find(
      (source: ReportSource) => source.role === "priority_context",
    );
    expect(priorityZoneSource?.retrievalStatus).toBe("unavailable");
    expect(priorityZoneSource?.retrievedAt).toBeNull();
  });

  it("both collision AND Priority Zone degrading simultaneously still yields exactly ONE 'partial' status, with BOTH limitations present", () => {
    const result = assembleIntersectionReport({
      selection: w40SelectionFixture,
      collisions: unavailableCollisions(),
      priorityZone: { status: "unavailable" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });

    expect(result.status).toBe("partial");
    expect(typeof result.status).toBe("string");
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        COLLISION_UNAVAILABLE_LIMITATION,
        PRIORITY_ZONE_UNAVAILABLE_LIMITATION,
      ]),
    );
    expect(result.limitations).toHaveLength(2);
  });
});

describe("assembleIntersectionReport — data-quality disclosure", () => {
  it("discloses '3 of 9' missing on_street_name records for the E 42 ST at PARK AVE fixture without suppressing the counts", () => {
    const result = assembleIntersectionReport({
      selection: e42SelectionFixture,
      collisions: availableCollisions(e42AtParkAveFixtureRows()),
      priorityZone: { status: "matched" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });

    expect(
      result.limitations.some(
        (limitation: string) =>
          limitation.includes("3 of 9") &&
          limitation.includes("on_street_name"),
      ),
    ).toBe(true);
    expect(result.metrics.crashes).toBe(9);
  });
});

describe("assembleIntersectionReport — source provenance", () => {
  it("always includes exactly 3 sources with the real Socrata IDs, never a placeholder", () => {
    const result = assembleIntersectionReport({
      selection: w40SelectionFixture,
      collisions: availableCollisions(w40At5AveFixtureRows()),
      priorityZone: { status: "matched" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });

    expect(result.sources).toHaveLength(3);

    const byRole = Object.fromEntries(
      result.sources.map((source: ReportSource) => [source.role, source]),
    );

    expect(byRole.selection_geometry?.datasetId).toBe("inkn-q76z");
    expect(byRole.collision_metrics?.datasetId).toBe("h9gi-nx95");
    expect(byRole.priority_context?.datasetId).toBe("qzji-nvbd");

    const realIds = new Set(["inkn-q76z", "h9gi-nx95", "qzji-nvbd"]);
    for (const source of result.sources) {
      expect(realIds.has(source.datasetId)).toBe(true);
      expect(source.name).toEqual(expect.any(String));
      expect(source.name.length).toBeGreaterThan(0);
      expect(source.url).toEqual(expect.any(String));
      expect(source.url.length).toBeGreaterThan(0);
      expect(source.queryDescription).toEqual(expect.any(String));
      expect(source.queryDescription.length).toBeGreaterThan(0);
      expect(["available", "unavailable"]).toContain(source.retrievalStatus);
    }
  });
});

describe("assembleIntersectionReport — zero-match is neutral, not a safety claim", () => {
  it("stays 'complete' for a successful zero-row collision query, with all-zero metrics and a summary that never contains the word 'safe'", () => {
    const result = assembleIntersectionReport({
      selection: w40SelectionFixture,
      collisions: availableCollisions([]),
      priorityZone: { status: "not_matched" },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    });

    expect(result.status).toBe("complete");
    expect(result.metrics.crashes).toBe(0);
    expect(result.metrics.peopleInjured).toBe(0);
    expect(result.metrics.contributingFactors).toEqual([]);
    expect(result.metrics.unspecifiedFactors).toBe(0);
    expect(result.summary.toLowerCase()).not.toContain("safe");
  });
});

describe("assembleIntersectionReport — purity", () => {
  it("returns deeply equal output across repeated calls with the same input", () => {
    const input = {
      selection: e42SelectionFixture,
      collisions: availableCollisions(e42AtParkAveFixtureRows()),
      priorityZone: { status: "matched" as const },
      generatedAt: ASSEMBLY_GENERATED_AT,
      reportId: ASSEMBLY_REPORT_ID,
    };

    const first = assembleIntersectionReport(input);
    const second = assembleIntersectionReport(input);

    expect(first).toEqual(second);
  });
});
