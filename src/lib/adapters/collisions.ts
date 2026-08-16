import { SERVER_RADIUS_METERS } from "../validation";
import { socrataHeaders } from "./socrata";

const COLLISIONS_ENDPOINT =
  "https://data.cityofnewyork.us/resource/h9gi-nx95.json";

const COLLISION_DATE_START = "2025-01-01T00:00:00.000";
const COLLISION_DATE_END = "2026-01-01T00:00:00.000";
const COLLISION_LIMIT = 5000;

const COLLISION_FIELDS = [
  "crash_date",
  "crash_time",
  "borough",
  "zip_code",
  "latitude",
  "longitude",
  "location",
  "on_street_name",
  "off_street_name",
  "cross_street_name",
  "number_of_persons_injured",
  "number_of_persons_killed",
  "number_of_pedestrians_injured",
  "number_of_pedestrians_killed",
  "number_of_cyclist_injured",
  "number_of_cyclist_killed",
  "number_of_motorist_injured",
  "number_of_motorist_killed",
  "contributing_factor_vehicle_1",
  "contributing_factor_vehicle_2",
  "contributing_factor_vehicle_3",
  "contributing_factor_vehicle_4",
  "contributing_factor_vehicle_5",
  "collision_id",
  "vehicle_type_code1",
  "vehicle_type_code2",
  "vehicle_type_code_3",
  "vehicle_type_code_4",
  "vehicle_type_code_5",
] as const;

export interface CollisionRow {
  crash_date?: string | null;
  crash_time?: string | null;
  borough?: string | null;
  zip_code?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  location?: unknown;
  on_street_name?: string | null;
  off_street_name?: string | null;
  cross_street_name?: string | null;
  number_of_persons_injured?: string | null;
  number_of_persons_killed?: string | null;
  number_of_pedestrians_injured?: string | null;
  number_of_pedestrians_killed?: string | null;
  number_of_cyclist_injured?: string | null;
  number_of_cyclist_killed?: string | null;
  number_of_motorist_injured?: string | null;
  number_of_motorist_killed?: string | null;
  contributing_factor_vehicle_1?: string | null;
  contributing_factor_vehicle_2?: string | null;
  contributing_factor_vehicle_3?: string | null;
  contributing_factor_vehicle_4?: string | null;
  contributing_factor_vehicle_5?: string | null;
  collision_id?: string | null;
  vehicle_type_code1?: string | null;
  vehicle_type_code2?: string | null;
  vehicle_type_code_3?: string | null;
  vehicle_type_code_4?: string | null;
  vehicle_type_code_5?: string | null;
}

export type CollisionFetchResult =
  | { status: "available"; rows: CollisionRow[]; retrievedAt: string }
  | {
      status: "unavailable";
      reason: "timeout" | "rate_limit" | "invalid_json" | "http_error";
      retrievedAt: string;
    };

export interface FetchCollisionsOptions {
  signal?: AbortSignal;
}

/**
 * The query radius is ADR-0003's analysis boundary itself — the same value
 * the report reports as `boundary.radiusMeters` — so it reads the canonical
 * `SERVER_RADIUS_METERS` rather than redeclaring 50. A local copy could drift
 * and silently produce a report whose stated boundary is not the boundary
 * that was queried.
 */
export function buildCollisionQueryUrl(coordinate: {
  latitude: number;
  longitude: number;
}): string {
  const url = new URL(COLLISIONS_ENDPOINT);
  url.searchParams.set("$select", COLLISION_FIELDS.join(","));
  url.searchParams.set(
    "$where",
    `within_circle(location, ${coordinate.latitude}, ${coordinate.longitude}, ${SERVER_RADIUS_METERS}) AND crash_date >= '${COLLISION_DATE_START}' AND crash_date < '${COLLISION_DATE_END}' AND location IS NOT NULL`,
  );
  url.searchParams.set("$limit", String(COLLISION_LIMIT));
  return url.toString();
}

export async function fetchCollisions(
  coordinate: { latitude: number; longitude: number },
  options?: FetchCollisionsOptions,
): Promise<CollisionFetchResult> {
  const url = buildCollisionQueryUrl(coordinate);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: socrataHeaders(),
      signal: options?.signal,
    });
  } catch {
    // Any rejected fetch (network failure, AbortError from a caller-supplied
    // signal, etc.) is treated as a timeout for reporting purposes.
    return {
      status: "unavailable",
      reason: "timeout",
      retrievedAt: new Date().toISOString(),
    };
  }

  if (!response.ok) {
    return {
      status: "unavailable",
      reason: response.status === 429 ? "rate_limit" : "http_error",
      retrievedAt: new Date().toISOString(),
    };
  }

  let rows: unknown;
  try {
    rows = await response.json();
  } catch {
    return {
      status: "unavailable",
      reason: "invalid_json",
      retrievedAt: new Date().toISOString(),
    };
  }

  if (!Array.isArray(rows)) {
    return {
      status: "unavailable",
      reason: "invalid_json",
      retrievedAt: new Date().toISOString(),
    };
  }

  return {
    status: "available",
    rows: rows as CollisionRow[],
    retrievedAt: new Date().toISOString(),
  };
}
