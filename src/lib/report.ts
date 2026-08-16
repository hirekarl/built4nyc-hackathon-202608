import type { CollisionFetchResult, CollisionRow } from "./adapters/collisions";
import type { ResolvedIntersection } from "./adapters/centerline";
import type { PriorityZoneResult } from "./adapters/priority-zones";
import {
  SERVER_PERIOD_END,
  SERVER_PERIOD_START,
  SERVER_RADIUS_METERS,
} from "./validation";
import type {
  ContributingFactorMetric,
  IntersectionReport,
  IntersectionReportMetrics,
  ReportSource,
} from "../types/report";

/**
 * Parses a raw NYPD numeric-count field into a well-formed non-negative
 * integer, or `null` if the value is missing/malformed.
 *
 * Absent (`undefined`), explicit `null`, empty string (`""`), non-numeric
 * strings, and negative numbers are all malformed -> `null`. A malformed
 * value is NEVER coerced to `0` (see docs/contract.md's null-vs-zero rule).
 */
function parseCount(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

/**
 * Accumulates a running `number | null` total against a newly parsed
 * value, per the per-metric malformed-value propagation rule: once a
 * metric has seen any malformed value, it stays `null` for the rest of
 * the aggregation regardless of subsequent clean values.
 */
function accumulateCount(
  runningTotal: number | null,
  nextValue: string | null | undefined,
): number | null {
  if (runningTotal === null) {
    return null;
  }
  const parsed = parseCount(nextValue);
  if (parsed === null) {
    return null;
  }
  return runningTotal + parsed;
}

const FACTOR_FIELDS = [
  "contributing_factor_vehicle_1",
  "contributing_factor_vehicle_2",
  "contributing_factor_vehicle_3",
  "contributing_factor_vehicle_4",
  "contributing_factor_vehicle_5",
] as const;

const UNSPECIFIED_FACTOR = "Unspecified";

export function aggregateCollisionMetrics(
  rows: CollisionRow[],
): IntersectionReportMetrics {
  let peopleInjured: number | null = 0;
  let peopleKilled: number | null = 0;
  let pedestriansInjured: number | null = 0;
  let pedestriansKilled: number | null = 0;
  let cyclistsInjured: number | null = 0;
  let cyclistsKilled: number | null = 0;
  let motoristsInjured: number | null = 0;
  let motoristsKilled: number | null = 0;
  let unspecifiedFactors = 0;

  const factorCounts = new Map<string, number>();

  for (const row of rows) {
    peopleInjured = accumulateCount(
      peopleInjured,
      row.number_of_persons_injured,
    );
    peopleKilled = accumulateCount(peopleKilled, row.number_of_persons_killed);
    pedestriansInjured = accumulateCount(
      pedestriansInjured,
      row.number_of_pedestrians_injured,
    );
    pedestriansKilled = accumulateCount(
      pedestriansKilled,
      row.number_of_pedestrians_killed,
    );
    cyclistsInjured = accumulateCount(
      cyclistsInjured,
      row.number_of_cyclist_injured,
    );
    cyclistsKilled = accumulateCount(
      cyclistsKilled,
      row.number_of_cyclist_killed,
    );
    motoristsInjured = accumulateCount(
      motoristsInjured,
      row.number_of_motorist_injured,
    );
    motoristsKilled = accumulateCount(
      motoristsKilled,
      row.number_of_motorist_killed,
    );

    const recordedFactors = FACTOR_FIELDS.map((field) => row[field]).filter(
      (value): value is string =>
        value !== null && value !== undefined && value !== "",
    );

    for (const factor of recordedFactors) {
      if (factor === UNSPECIFIED_FACTOR) {
        unspecifiedFactors += 1;
        continue;
      }
      factorCounts.set(factor, (factorCounts.get(factor) ?? 0) + 1);
    }
  }

  const contributingFactors: ContributingFactorMetric[] = Array.from(
    factorCounts.entries(),
  )
    .map(([factor, count]) => ({ factor, count }))
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return a.factor < b.factor ? -1 : a.factor > b.factor ? 1 : 0;
    });

  return {
    crashes: rows.length,
    peopleInjured,
    peopleKilled,
    pedestriansInjured,
    pedestriansKilled,
    cyclistsInjured,
    cyclistsKilled,
    motoristsInjured,
    motoristsKilled,
    contributingFactors,
    unspecifiedFactors,
  };
}

const COLLISION_UNAVAILABLE_LIMITATION =
  "Motor Vehicle Collisions - Crashes is unavailable, so collision metrics could not be computed.";
const PRIORITY_ZONE_UNAVAILABLE_LIMITATION =
  "VZV Priority Zones or Areas is unavailable, so boundary overlap could not be checked.";
const ON_STREET_NAME_NOTE =
  "The matched crash records had coordinates, so missing street labels do not change the coordinate-based counts.";

const NULL_METRICS: IntersectionReportMetrics = {
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
};

/**
 * "complete" only when both the collision and Priority Zone sources are
 * healthy — otherwise exactly ONE "partial" status regardless of how many
 * sources degraded simultaneously (docs/contract.md).
 */
function computeStatus(
  collisions: CollisionFetchResult,
  priorityZone: PriorityZoneResult,
): "complete" | "partial" {
  const collisionsAvailable = collisions.status === "available";
  const priorityZoneAvailable = priorityZone.status !== "unavailable";
  return collisionsAvailable && priorityZoneAvailable ? "complete" : "partial";
}

function buildSummary(collisions: CollisionFetchResult): string {
  if (collisions.status !== "available") {
    return "Crash metrics are unavailable because a required source could not be retrieved.";
  }
  const crashes = collisions.rows.length;
  if (crashes === 0) {
    return "No reported crashes matched this boundary and period.";
  }
  return `${crashes} reported crashes matched this boundary and period.`;
}

/**
 * Data-quality limitation + companion note for rows missing
 * `on_street_name`, computed only when collisions are available and the
 * missing count is neither 0 (nothing to disclose) nor the full row count
 * (that would instead be a collision-source outage, not a labeling gap).
 */
function buildDataQualityDisclosure(collisions: CollisionFetchResult): {
  limitation: string | null;
  note: string | null;
} {
  if (collisions.status !== "available") {
    return { limitation: null, note: null };
  }
  const totalCount = collisions.rows.length;
  const missingCount = collisions.rows.filter(
    (row) => !row.on_street_name,
  ).length;
  if (missingCount === 0 || missingCount === totalCount) {
    return { limitation: null, note: null };
  }
  return {
    limitation: `${missingCount} of ${totalCount} crash records are missing on_street_name.`,
    note: ON_STREET_NAME_NOTE,
  };
}

function buildLimitations(
  collisions: CollisionFetchResult,
  priorityZone: PriorityZoneResult,
): string[] {
  const limitations: string[] = [];
  if (collisions.status !== "available") {
    limitations.push(COLLISION_UNAVAILABLE_LIMITATION);
  }
  if (priorityZone.status === "unavailable") {
    limitations.push(PRIORITY_ZONE_UNAVAILABLE_LIMITATION);
  }
  const { limitation } = buildDataQualityDisclosure(collisions);
  if (limitation) {
    limitations.push(limitation);
  }
  return limitations;
}

function buildNotes(collisions: CollisionFetchResult): string[] {
  const { note } = buildDataQualityDisclosure(collisions);
  return note ? [note] : [];
}

function buildSources(
  collisions: CollisionFetchResult,
  priorityZone: PriorityZoneResult,
  generatedAt: string,
): ReportSource[] {
  return [
    {
      name: "NYC Street Centerline",
      datasetId: "inkn-q76z",
      url: "https://data.cityofnewyork.us/City-Government/Centerline/3mf9-qshr",
      role: "selection_geometry",
      retrievalStatus: "available",
      retrievedAt: generatedAt,
      queryDescription: "Eligible street geometry is loaded by map viewport.",
    },
    {
      name: "Motor Vehicle Collisions - Crashes",
      datasetId: "h9gi-nx95",
      url: "https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95",
      role: "collision_metrics",
      retrievalStatus: collisions.status,
      retrievedAt:
        collisions.status === "available" ? collisions.retrievedAt : null,
      queryDescription:
        "Crash records are queried within 50 meters for calendar year 2025.",
    },
    {
      name: "VZV Priority Zones or Areas",
      datasetId: "qzji-nvbd",
      url: "https://data.cityofnewyork.us/Transportation/VZV-Priority-Zones-or-Areas/qzji-nvbd",
      role: "priority_context",
      retrievalStatus:
        priorityZone.status === "unavailable" ? "unavailable" : "available",
      retrievedAt: priorityZone.status === "unavailable" ? null : generatedAt,
      queryDescription:
        "Five multipolygons are fetched and checked for boundary overlap.",
    },
  ];
}

/**
 * Assembles the full, deterministic `IntersectionReport` from the resolved
 * selection and the two independently fetched sources (Step 2.4's
 * collisions and Step 2.6's Priority Zone result). Pure: `generatedAt` and
 * `reportId` are injected, never read/generated internally, so identical
 * input always produces a deeply equal output.
 */
export function assembleIntersectionReport(input: {
  selection: ResolvedIntersection;
  collisions: CollisionFetchResult;
  priorityZone: PriorityZoneResult;
  generatedAt: string;
  reportId: string;
}): IntersectionReport {
  const { selection, collisions, priorityZone, generatedAt, reportId } = input;

  const metrics =
    collisions.status === "available"
      ? aggregateCollisionMetrics(collisions.rows)
      : NULL_METRICS;

  return {
    schemaVersion: "1",
    reportId,
    generatedAt,
    status: computeStatus(collisions, priorityZone),
    summary: buildSummary(collisions),
    selection: {
      kind: "intersection",
      ...selection,
    },
    boundary: { kind: "circle", radiusMeters: SERVER_RADIUS_METERS },
    period: {
      startInclusive: SERVER_PERIOD_START,
      endExclusive: SERVER_PERIOD_END,
    },
    metrics,
    priorityZone,
    limitations: buildLimitations(collisions, priorityZone),
    notes: buildNotes(collisions),
    sources: buildSources(collisions, priorityZone, generatedAt),
  };
}
