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
import { aggregateCollisionMetrics } from "./report";
import type { CollisionRow } from "./adapters/collisions";
import type { IntersectionReportMetrics } from "../types/report";

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
