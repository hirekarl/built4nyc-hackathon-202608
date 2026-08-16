import type { CollisionRow } from "./adapters/collisions";
import type {
  ContributingFactorMetric,
  IntersectionReportMetrics,
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
