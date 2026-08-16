import { validateReportRequest } from "../../../../lib/validation";
import {
  CenterlineSourceError,
  resolveIntersectionSelection,
} from "../../../../lib/adapters/centerline";
import { fetchCollisions } from "../../../../lib/adapters/collisions";
import { resolvePriorityZone } from "../../../../lib/adapters/priority-zones";
import { assembleIntersectionReport } from "../../../../lib/report";
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

  const [collisions, priorityZone] = await Promise.all([
    fetchCollisions(resolved.coordinate),
    resolvePriorityZone(resolved.coordinate),
  ]);

  const report = assembleIntersectionReport({
    selection: resolved,
    collisions,
    priorityZone,
    generatedAt: new Date().toISOString(),
    reportId: crypto.randomUUID(),
  });

  return Response.json(report, { status: 200 });
}
