import type { MultiPolygon, Polygon } from "geojson";
import { circleIntersectsPolygon, createCircleFeature } from "../geometry";
import type { GeographicCoordinate } from "../geometry";

const PRIORITY_ZONES_ENDPOINT =
  "https://data.cityofnewyork.us/resource/qzji-nvbd.json";

const PRIORITY_ZONE_RADIUS_METERS = 50;

const PRIORITY_ZONE_FIELDS = [
  "the_geom",
  "sq_mi",
  "shape_leng",
  "shape_area",
] as const;

export type PriorityZoneResult =
  { status: "matched" } | { status: "not_matched" } | { status: "unavailable" };

interface PriorityZoneRow {
  the_geom?: unknown;
}

// Process-lifetime cache of the parsed qzji-nvbd polygons (there are only 5
// rows total, so this dataset is fetched at most once per process). Failures
// are never cached — see the comment on __resetPriorityZoneCache and the
// catch/fallback branches below.
let cachedZonesPromise: Promise<(Polygon | MultiPolygon)[]> | null = null;

/**
 * Test-only seam: clears the process-lifetime qzji-nvbd cache so each test
 * can start from a known state without a real fetch. Never call this from
 * application code.
 */
export function __resetPriorityZoneCache(): void {
  cachedZonesPromise = null;
}

function fetchHeaders(): HeadersInit | undefined {
  const token = process.env.SOCRATA_APP_TOKEN;
  return token ? { "X-App-Token": token } : undefined;
}

function buildPriorityZoneQueryUrl(): string {
  const url = new URL(PRIORITY_ZONES_ENDPOINT);
  url.searchParams.set("$select", PRIORITY_ZONE_FIELDS.join(","));
  return url.toString();
}

function isPolygonOrMultiPolygon(
  value: unknown,
): value is Polygon | MultiPolygon {
  return (
    typeof value === "object" &&
    value !== null &&
    ((value as { type?: unknown }).type === "Polygon" ||
      (value as { type?: unknown }).type === "MultiPolygon")
  );
}

async function fetchPriorityZones(): Promise<(Polygon | MultiPolygon)[]> {
  const url = buildPriorityZoneQueryUrl();

  const response = await fetch(url, { headers: fetchHeaders() });

  if (!response.ok) {
    throw new Error(`Priority Zones request failed (${response.status}).`);
  }

  const rows: unknown = await response.json();

  if (!Array.isArray(rows)) {
    throw new Error("Priority Zones returned an invalid response.");
  }

  return (rows as PriorityZoneRow[])
    .map((row) => row.the_geom)
    .filter(isPolygonOrMultiPolygon);
}

function loadPriorityZones(): Promise<(Polygon | MultiPolygon)[]> {
  if (!cachedZonesPromise) {
    cachedZonesPromise = fetchPriorityZones().catch((error: unknown) => {
      // Do not cache failures: clear the in-flight promise so the next call
      // retries the fetch instead of staying "unavailable" for the rest of
      // the process's lifetime.
      cachedZonesPromise = null;
      throw error;
    });
  }
  return cachedZonesPromise;
}

/**
 * Resolves whether a coordinate's 50m boundary circle intersects any of the
 * (at most 5) Priority Zone polygons. Never throws — every failure resolves
 * to { status: "unavailable" }, since a degraded priority source is a
 * partial report, not a failed request. Returns only a status, never a zone
 * name/ID/borough, because qzji-nvbd has no such column.
 */
export async function resolvePriorityZone(
  coordinate: GeographicCoordinate,
): Promise<PriorityZoneResult> {
  let zones: (Polygon | MultiPolygon)[];
  try {
    zones = await loadPriorityZones();
  } catch {
    return { status: "unavailable" };
  }

  const circle = createCircleFeature(coordinate, PRIORITY_ZONE_RADIUS_METERS);
  const matched = zones.some((zone) => circleIntersectsPolygon(circle, zone));

  return { status: matched ? "matched" : "not_matched" };
}
