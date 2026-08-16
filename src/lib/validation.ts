import type {
  IntersectionReportRequest,
  IntersectionReportValidationErrorCode,
  IntersectionSelection,
} from "../types/report";

/**
 * Server-owned constants for the report boundary and period.
 *
 * Per [FORCES] a request supplying matching values never grants authority —
 * these constants are the sole source of truth for the parsed request
 * returned on the `ok: true` branch, never the client's own values.
 */
export const SERVER_RADIUS_METERS = 50;
export const SERVER_PERIOD_START = "2025-01-01";
export const SERVER_PERIOD_END = "2026-01-01";

export type ReportRequestValidationResult =
  | { ok: true; request: IntersectionReportRequest }
  | {
      ok: false;
      code: IntersectionReportValidationErrorCode;
      message: string;
    };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(
  code: IntersectionReportValidationErrorCode,
  message: string,
): { ok: false; code: IntersectionReportValidationErrorCode; message: string } {
  return { ok: false, code, message };
}

const RAW_QUERY_KEYS = new Set(["$where", "$select", "query", "soql"]);

/**
 * These patterns are applied to EVERY string in the payload, not only to the
 * `RAW_QUERY_KEYS` values — defense in depth, since the point is that no
 * client-supplied string is ever spliced into a query anywhere.
 *
 * That breadth is why the SELECT pattern requires an actual SoQL shape (a
 * `select` … `from` pair on word boundaries) rather than the bare `select `
 * substring. Unanchored, `select ` would reject any legitimate intersection
 * whose official street name happened to contain those seven characters,
 * returning `raw_query_not_allowed` for a request with no injection risk at
 * all.
 */
const RAW_QUERY_STRING_PATTERNS: RegExp[] = [
  /within_circle\(/i,
  /\bselect\b[\s\S]{0,120}?\bfrom\b/i,
  /--/,
];

function containsRawQueryMarkers(value: unknown): boolean {
  if (typeof value === "string") {
    return RAW_QUERY_STRING_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsRawQueryMarkers(item));
  }
  if (isRecord(value)) {
    return Object.entries(value).some(
      ([key, nested]) =>
        RAW_QUERY_KEYS.has(key) || containsRawQueryMarkers(nested),
    );
  }
  return false;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * A generous NYC bounding box, well beyond the five boroughs. Selections
 * come from the official NYC Street Centerline dataset, so any valid
 * coordinate falls inside this box — a swapped lat/lng pair (PRD §13) lands
 * far outside it even when each raw number is independently within the
 * global [-90, 90] / [-180, 180] range.
 */
const NYC_LATITUDE_RANGE = { min: 40.4, max: 41.0 };
const NYC_LONGITUDE_RANGE = { min: -74.3, max: -73.65 };

function isValidCoordinate(
  value: unknown,
): value is { latitude: number; longitude: number } {
  if (!isRecord(value)) return false;
  const { latitude, longitude } = value;
  return (
    isFiniteNumber(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    isFiniteNumber(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= NYC_LATITUDE_RANGE.min &&
    latitude <= NYC_LATITUDE_RANGE.max &&
    longitude >= NYC_LONGITUDE_RANGE.min &&
    longitude <= NYC_LONGITUDE_RANGE.max
  );
}

export function validateReportRequest(
  body: unknown,
): ReportRequestValidationResult {
  // Raw-SoQL-shaped input is rejected first regardless of what else is
  // (in)valid about the body — the server never trusts client-supplied
  // query fragments, wherever they appear in the payload.
  if (containsRawQueryMarkers(body)) {
    return fail(
      "raw_query_not_allowed",
      "This request contains disallowed raw query syntax.",
    );
  }

  if (!isRecord(body)) {
    return fail("invalid_request", "The request body must be a JSON object.");
  }

  if (body.schemaVersion !== "1") {
    return fail(
      "invalid_request",
      "The request body has an unsupported schema version.",
    );
  }

  const selection = body.selection;
  if (
    !isRecord(selection) ||
    typeof selection.displayName !== "string" ||
    !isStringArray(selection.streetNames) ||
    !isStringArray(selection.physicalIds)
  ) {
    return fail(
      "invalid_request",
      "The request body is missing required selection fields.",
    );
  }

  if (selection.kind !== "intersection") {
    return fail(
      "unsupported_selection_kind",
      "Only intersection selections are supported.",
    );
  }

  if (!isValidCoordinate(selection.coordinate)) {
    return fail(
      "invalid_coordinate",
      "The selected intersection coordinate is invalid.",
    );
  }

  const boundary = body.boundary;
  if (!isRecord(boundary) || boundary.kind !== "circle") {
    return fail(
      "invalid_request",
      "The request body is missing a valid boundary.",
    );
  }

  if (boundary.radiusMeters !== SERVER_RADIUS_METERS) {
    return fail(
      "unsupported_radius",
      "The report boundary radius is not supported.",
    );
  }

  const period = body.period;
  if (!isRecord(period)) {
    return fail(
      "invalid_request",
      "The request body is missing a valid period.",
    );
  }

  if (
    period.startInclusive !== SERVER_PERIOD_START ||
    period.endExclusive !== SERVER_PERIOD_END
  ) {
    return fail("unsupported_period", "The report period is not supported.");
  }

  const normalizedSelection: IntersectionSelection = {
    kind: "intersection",
    displayName: selection.displayName,
    coordinate: {
      latitude: selection.coordinate.latitude,
      longitude: selection.coordinate.longitude,
    },
    streetNames: [...selection.streetNames],
    physicalIds: [...selection.physicalIds],
  };

  const request: IntersectionReportRequest = {
    schemaVersion: "1",
    selection: normalizedSelection,
    boundary: {
      kind: "circle",
      radiusMeters: SERVER_RADIUS_METERS,
    },
    period: {
      startInclusive: SERVER_PERIOD_START,
      endExclusive: SERVER_PERIOD_END,
    },
  };

  return { ok: true, request };
}
