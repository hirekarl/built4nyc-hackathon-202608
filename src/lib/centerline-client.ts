import type {
  Feature,
  FeatureCollection,
  MultiLineString,
  Point,
} from "geojson";
import type { IntersectionSelection } from "../types/report";

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

export interface CenterlineBounds {
  north: number;
  west: number;
  south: number;
  east: number;
}

export interface NormalizedCenterline {
  physicalId: string;
  streetName: string;
  fromLevel: string;
  toLevel: string;
  geometry: NormalizedMultiLineString;
  b5sc: string | null;
  bPhysId: string | null;
  globalId: string | null;
}

export interface NormalizedMultiLineString extends MultiLineString {
  coordinates: [number, number][][];
}

export interface IntersectionCandidate extends IntersectionSelection {
  level: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function endpointLevel(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function streetLabel(row: UnknownRecord): string | null {
  const value =
    optionalString(row.stname_label) ?? optionalString(row.full_street_name);
  return value?.replace(/\s+/g, " ") ?? null;
}

function isCoordinate(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length < 2) return false;
  const [longitude, latitude] = value;
  return (
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function normalizeGeometry(value: unknown): NormalizedMultiLineString | null {
  if (!isRecord(value) || value.type !== "MultiLineString") return null;
  if (!Array.isArray(value.coordinates)) return null;

  const coordinates = value.coordinates.filter(
    (line): line is [number, number][] =>
      Array.isArray(line) && line.length >= 2 && line.every(isCoordinate),
  );

  return coordinates.length > 0
    ? { type: "MultiLineString", coordinates }
    : null;
}

function normalizeCenterlineRow(row: unknown): NormalizedCenterline | null {
  if (!isRecord(row) || row.rw_type !== "1") return null;
  if (row.nonped !== undefined && row.nonped !== null && row.nonped !== "") {
    return null;
  }

  const physicalId = optionalString(row.physicalid);
  const fromLevel = endpointLevel(row.from_level_code);
  const toLevel = endpointLevel(row.to_level_code);
  const normalizedStreetName = streetLabel(row);
  const geometry = normalizeGeometry(row.the_geom);

  if (
    !physicalId ||
    fromLevel === null ||
    toLevel === null ||
    !normalizedStreetName ||
    !geometry
  ) {
    return null;
  }

  return {
    physicalId,
    streetName: normalizedStreetName,
    fromLevel,
    toLevel,
    geometry,
    b5sc: optionalString(row.b5sc),
    bPhysId: optionalString(row.bphys_id),
    globalId: optionalString(row.globalid),
  };
}

function assertValidBounds(bounds: CenterlineBounds): void {
  const { north, west, south, east } = bounds;
  const values = [north, west, south, east];
  const finite = values.every(Number.isFinite);
  const inRange =
    north >= -90 &&
    north <= 90 &&
    south >= -90 &&
    south <= 90 &&
    west >= -180 &&
    west <= 180 &&
    east >= -180 &&
    east <= 180;

  if (!finite || !inRange || north <= south || east <= west) {
    throw new Error("Invalid centerline viewport bounds.");
  }
}

export function buildCenterlineUrl(bounds: CenterlineBounds): string {
  assertValidBounds(bounds);

  const url = new URL(CENTERLINE_ENDPOINT);
  url.searchParams.set("$select", CENTERLINE_FIELDS.join(","));
  url.searchParams.set(
    "$where",
    `within_box(the_geom, ${bounds.north}, ${bounds.west}, ${bounds.south}, ${bounds.east}) AND rw_type='1' AND (nonped IS NULL OR nonped='')`,
  );
  return url.toString();
}

export function normalizeCenterlineRows(
  rows: readonly unknown[],
): NormalizedCenterline[] {
  return rows.flatMap((row) => {
    const normalized = normalizeCenterlineRow(row);
    return normalized ? [normalized] : [];
  });
}

export async function fetchEligibleCenterlines(
  bounds: CenterlineBounds,
  options: { signal?: AbortSignal } = {},
): Promise<NormalizedCenterline[]> {
  const url = buildCenterlineUrl(bounds);
  const response = await fetch(url, { signal: options.signal });

  if (!response.ok) {
    throw new Error(
      `NYC Street Centerline request failed (${response.status}).`,
    );
  }

  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("NYC Street Centerline returned an invalid response.");
  }

  return normalizeCenterlineRows(rows);
}

interface CandidateGroup {
  coordinate: { longitude: number; latitude: number };
  level: string;
  streetNames: string[];
  physicalIds: string[];
}

function addEndpoint(
  groups: Map<string, CandidateGroup>,
  centerline: NormalizedCenterline,
  coordinate: [number, number],
  level: string,
): void {
  const [longitude, latitude] = coordinate;
  const key = `${longitude}|${latitude}|${level}`;
  const group = groups.get(key) ?? {
    coordinate: { longitude, latitude },
    level,
    streetNames: [],
    physicalIds: [],
  };

  if (!group.streetNames.includes(centerline.streetName)) {
    group.streetNames.push(centerline.streetName);
  }
  if (!group.physicalIds.includes(centerline.physicalId)) {
    group.physicalIds.push(centerline.physicalId);
  }
  groups.set(key, group);
}

/**
 * Step 1.3 decision — multi-roadbed node naming fallback.
 *
 * Candidates are grouped on the exact endpoint key `longitude|latitude|level`:
 * no coordinate snapping tolerance, and the from/to level code is part of the
 * key so different roadbeds and grades never collapse into one intersection.
 * Names come from `stname_label`, falling back to `full_street_name`. A group
 * is only exposed once it holds at least two distinct eligible street names.
 *
 * This resolves ordinary intersections correctly — the verified control fixture
 * (physical ID 183093, W 40 ST between 5 AVE and AVE OF THE AMERICAS) groups as
 * expected. It deliberately does not solve Grand Central, whose Park Avenue
 * roadbeds and PARK AVE VIADUCT stay separate candidates rather than one named
 * node. That remains a documented limitation, not a solved case; an official
 * LION/Geosupport node fallback would be the real fix. See docs/contract.md.
 */
export function groupIntersectionCandidates(
  centerlines: readonly NormalizedCenterline[],
): IntersectionCandidate[] {
  const groups = new Map<string, CandidateGroup>();

  centerlines.forEach((centerline) => {
    const lines = centerline.geometry.coordinates;
    const firstLine = lines[0];
    const lastLine = lines.at(-1);
    if (!firstLine || !lastLine) return;

    const first = firstLine[0];
    const last = lastLine.at(-1);
    if (!first || !last) return;

    addEndpoint(groups, centerline, first, centerline.fromLevel);
    addEndpoint(groups, centerline, last, centerline.toLevel);
  });

  return [...groups.values()]
    .filter(({ streetNames }) => streetNames.length >= 2)
    .map(({ coordinate, level, streetNames, physicalIds }) => ({
      kind: "intersection",
      displayName: streetNames.join(" at "),
      coordinate,
      level,
      streetNames,
      physicalIds,
    }));
}

export function centerlinesFeatureCollection(
  centerlines: readonly NormalizedCenterline[],
): FeatureCollection<MultiLineString> {
  const features: Array<Feature<MultiLineString>> = centerlines.map(
    (centerline) => ({
      type: "Feature",
      geometry: centerline.geometry,
      properties: {
        physicalId: centerline.physicalId,
        streetName: centerline.streetName,
      },
    }),
  );
  return { type: "FeatureCollection", features };
}

export function candidatesFeatureCollection(
  candidates: readonly IntersectionCandidate[],
): FeatureCollection<Point> {
  const features: Array<Feature<Point>> = candidates.map(
    (candidate, index) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          candidate.coordinate.longitude,
          candidate.coordinate.latitude,
        ],
      },
      properties: {
        candidateIndex: index,
        displayName: candidate.displayName,
        level: candidate.level,
        streetNames: candidate.streetNames,
        physicalIds: candidate.physicalIds,
      },
    }),
  );
  return { type: "FeatureCollection", features };
}
