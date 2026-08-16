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

// Metres per degree of latitude is effectively constant across NYC's small
// latitude range. Metres per degree of longitude shrinks by cos(latitude) —
// at NYC's ~40.7 degrees N that's roughly a 24% difference from the latitude
// figure, so the two conversions must NOT share one constant.
const METERS_PER_DEGREE_LATITUDE = 111_320;

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

// `boxHalfExtentMeters` names what this value actually is now that it drives
// a bounding-box polygon rather than a circle: the half-width/half-height of
// a lookup WINDOW used to find centerlines near the submitted coordinate. It
// happens to share a 50 m value with ADR-0003's official-intersection
// analysis boundary, but that is a coincidence of the verified fix, not a
// shared concept — do not collapse the two in a future refactor. This window
// answers "what centerlines are near this point?"; the analysis boundary
// answers "what counts as inside the intersection for crash analysis?".
export function buildIntersectionLookupUrl(
  coordinate: { latitude: number; longitude: number },
  boxHalfExtentMeters: number,
): string {
  const latitudeDeltaDegrees = boxHalfExtentMeters / METERS_PER_DEGREE_LATITUDE;
  const metersPerDegreeLongitude =
    METERS_PER_DEGREE_LATITUDE *
    Math.cos((coordinate.latitude * Math.PI) / 180);
  const longitudeDeltaDegrees = boxHalfExtentMeters / metersPerDegreeLongitude;

  const minLon = coordinate.longitude - longitudeDeltaDegrees;
  const maxLon = coordinate.longitude + longitudeDeltaDegrees;
  const minLat = coordinate.latitude - latitudeDeltaDegrees;
  const maxLat = coordinate.latitude + latitudeDeltaDegrees;

  // WKT vertex order is `lon lat`, NOT `lat lon`. The ring must be closed by
  // repeating the first vertex as the last.
  const vertices: Array<[number, number]> = [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat],
  ];
  const polygonWkt = `POLYGON((${vertices
    .map(([lon, lat]) => `${lon} ${lat}`)
    .join(", ")}))`;

  const url = new URL(CENTERLINE_ENDPOINT);
  url.searchParams.set("$select", CENTERLINE_FIELDS.join(","));
  url.searchParams.set(
    "$where",
    `rw_type='1' AND (nonped IS NULL OR nonped='') AND intersects(the_geom, '${polygonWkt}')`,
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
