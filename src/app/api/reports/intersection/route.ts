import {
  SERVER_PERIOD_END,
  SERVER_PERIOD_START,
  SERVER_RADIUS_METERS,
  validateReportRequest,
} from "../../../../lib/validation";
import {
  CenterlineSourceError,
  resolveIntersectionSelection,
} from "../../../../lib/adapters/centerline";
import type {
  IntersectionReportErrorResponse,
  IntersectionReportValidationErrorCode,
} from "../../../../types/report";

/**
 * Builds the exact contract error body for a given code, defaulting
 * `retryable` to `false` for every validation code — `source_failure` is the
 * only code that ever sets `retryable: true`.
 */
function errorResponse(
  status: number,
  code: IntersectionReportValidationErrorCode | "source_failure",
  message: string,
  retryable: boolean,
): Response {
  const body = {
    schemaVersion: "1",
    error: { code, message, retryable },
  } as IntersectionReportErrorResponse;
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "invalid_request",
      "The request body must be valid JSON.",
      false,
    );
  }

  const validation = validateReportRequest(body);
  if (!validation.ok) {
    return errorResponse(400, validation.code, validation.message, false);
  }

  let resolved;
  try {
    resolved = await resolveIntersectionSelection(validation.request.selection);
  } catch (error) {
    if (error instanceof CenterlineSourceError) {
      return errorResponse(
        503,
        "source_failure",
        "The NYC Street Centerline data source is temporarily unavailable.",
        true,
      );
    }
    throw error;
  }

  if (!resolved) {
    return errorResponse(
      400,
      "intersection_not_found",
      "The selected intersection could not be resolved against the official street centerline data.",
      false,
    );
  }

  // TODO(2.4-2.7): compute crash/injury/fatality metrics, contributing
  // factor rollups, Priority Zone overlap, completeness status, summary,
  // limitations, notes, and sources here. Until then this is a deterministic
  // placeholder response containing only what's fully determined by
  // validation + centerline resolution.
  return Response.json(
    {
      schemaVersion: "1",
      selection: {
        kind: "intersection",
        displayName: resolved.displayName,
        coordinate: resolved.coordinate,
        streetNames: resolved.streetNames,
        physicalIds: resolved.physicalIds,
      },
      boundary: {
        kind: "circle",
        radiusMeters: SERVER_RADIUS_METERS,
      },
      period: {
        startInclusive: SERVER_PERIOD_START,
        endExclusive: SERVER_PERIOD_END,
      },
    },
    { status: 200 },
  );
}
