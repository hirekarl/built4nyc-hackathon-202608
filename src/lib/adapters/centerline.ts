import type { IntersectionSelection } from "../../types/report";
import {
  groupIntersectionCandidates,
  normalizeCenterlineRows,
} from "../centerline-client";

const CENTERLINE_ENDPOINT =
  "https://data.cityofnewyork.us/resource/inkn-q76z.json";

const CENTERLINE_FIELDS = [
  "the_geom",
  "physicalid",
  "rw_type",
  "nonped",
  "from_level_code",
  "to_level_code",
  "full_street_name",
  "street_name",
  "stname_label",
  "b5sc",
  "bphys_id",
  "globalid",
] as const;

const COORDINATE_MATCH_EPSILON = 1e-9;

export interface ResolvedIntersection {
  displayName: string;
  coordinate: { latitude: number; longitude: number };
  streetNames: string[];
  physicalIds: string[];
}

export class CenterlineSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CenterlineSourceError";
  }
}

export function buildIntersectionLookupUrl(
  coordinate: { latitude: number; longitude: number },
  radiusMeters: number,
): string {
  const url = new URL(CENTERLINE_ENDPOINT);
  url.searchParams.set("$select", CENTERLINE_FIELDS.join(","));
  url.searchParams.set(
    "$where",
    `rw_type='1' AND (nonped IS NULL OR nonped='') AND within_circle(the_geom, ${coordinate.latitude}, ${coordinate.longitude}, ${radiusMeters})`,
  );
  return url.toString();
}

function fetchHeaders(): HeadersInit | undefined {
  const token = process.env.SOCRATA_APP_TOKEN;
  return token ? { "X-App-Token": token } : undefined;
}

function coordinatesMatch(
  a: { longitude: number; latitude: number },
  b: { latitude: number; longitude: number },
): boolean {
  return (
    Math.abs(a.longitude - b.longitude) < COORDINATE_MATCH_EPSILON &&
    Math.abs(a.latitude - b.latitude) < COORDINATE_MATCH_EPSILON
  );
}

export async function resolveIntersectionSelection(
  submitted: IntersectionSelection,
): Promise<ResolvedIntersection | null> {
  const url = buildIntersectionLookupUrl(submitted.coordinate, 50);

  let response: Response;
  try {
    response = await fetch(url, { headers: fetchHeaders() });
  } catch (error) {
    throw new CenterlineSourceError(
      `NYC Street Centerline request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    throw new CenterlineSourceError(
      `NYC Street Centerline request failed (${response.status}).`,
    );
  }

  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) {
    throw new CenterlineSourceError(
      "NYC Street Centerline returned an invalid response.",
    );
  }

  const centerlines = normalizeCenterlineRows(rows);
  const candidates = groupIntersectionCandidates(centerlines);

  const matched = candidates.find((candidate) =>
    coordinatesMatch(candidate.coordinate, submitted.coordinate),
  );

  if (!matched) return null;

  return {
    displayName: matched.displayName,
    coordinate: {
      latitude: matched.coordinate.latitude,
      longitude: matched.coordinate.longitude,
    },
    streetNames: matched.streetNames,
    physicalIds: matched.physicalIds,
  };
}
