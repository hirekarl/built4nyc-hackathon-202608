import { describe, expect, it } from "vitest";
import type {
  IntersectionReportRequest,
  IntersectionReportValidationErrorCode,
} from "../types/report";
import {
  SERVER_PERIOD_END,
  SERVER_PERIOD_START,
  SERVER_RADIUS_METERS,
  validateReportRequest,
} from "./validation";

/**
 * API surface under test (implemented next by `builder` in ./validation.ts):
 *
 *   export const SERVER_RADIUS_METERS: 50;
 *   export const SERVER_PERIOD_START: "2025-01-01";
 *   export const SERVER_PERIOD_END: "2026-01-01";
 *
 *   export type ReportRequestValidationResult =
 *     | { ok: true; request: IntersectionReportRequest }
 *     | {
 *         ok: false;
 *         code: IntersectionReportValidationErrorCode;
 *         message: string;
 *       };
 *
 *   export function validateReportRequest(
 *     body: unknown,
 *   ): ReportRequestValidationResult;
 *
 * Coercion decisions (per [FORCES] — server-owned constants are never
 * client-trusted, so strictness is the safer contract):
 *
 * 1. `boundary.radiusMeters` MUST be the JS number literal `50`, never a
 *    string. `"50.0"` (or `"50"`) is REJECTED as `unsupported_radius` — no
 *    string-to-number coercion is performed anywhere in this validator.
 * 2. `period.startInclusive` / `period.endExclusive` MUST be the exact
 *    literal strings `"2025-01-01"` / `"2026-01-01"`. An equivalent-but-
 *    different ISO representation (e.g. a full timestamp with a `Z` suffix)
 *    is REJECTED as `unsupported_period` — exact literal string match only,
 *    no date-equivalence parsing.
 *
 * Regardless of what the client supplies (even if it happens to match), the
 * parsed `request.boundary.radiusMeters` / `request.period` returned on the
 * `ok: true` branch are always the server's own constants — never values
 * copied through from the request body. This is asserted via reference/
 * value equality against the exported constants in the "authority" tests
 * below.
 */

/**
 * The nested members stay `Record<string, unknown>` rather than the frozen
 * contract types so tests can spread a valid body and swap in malformed
 * values, while still type-checking under `strict`.
 */
type RequestBodyFixture = Record<string, unknown> & {
  selection?: Record<string, unknown>;
  boundary?: Record<string, unknown>;
  period?: Record<string, unknown>;
};

function validRequest(
  overrides: Record<string, unknown> = {},
): RequestBodyFixture {
  return {
    schemaVersion: "1",
    selection: {
      kind: "intersection",
      displayName: "W 40 ST at 5 AVE",
      coordinate: {
        latitude: 40.7522,
        longitude: -73.9818,
      },
      streetNames: ["W 40 ST", "5 AVE"],
      physicalIds: ["100", "101"],
    },
    boundary: {
      kind: "circle",
      radiusMeters: 50,
    },
    period: {
      startInclusive: "2025-01-01",
      endExclusive: "2026-01-01",
    },
    ...overrides,
  };
}

function expectRejected(
  body: unknown,
  code: IntersectionReportValidationErrorCode,
) {
  const result = validateReportRequest(body);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe(code);
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  }
  return result;
}

describe("server-owned constants", () => {
  it("fixes the radius at 50 meters and the calendar-year-2025 period", () => {
    expect(SERVER_RADIUS_METERS).toBe(50);
    expect(SERVER_PERIOD_START).toBe("2025-01-01");
    expect(SERVER_PERIOD_END).toBe("2026-01-01");
  });
});

describe("happy path", () => {
  it("accepts a fully valid request body and returns the parsed request", () => {
    const result = validateReportRequest(validRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      const request: IntersectionReportRequest = result.request;
      expect(request).toEqual({
        schemaVersion: "1",
        selection: {
          kind: "intersection",
          displayName: "W 40 ST at 5 AVE",
          coordinate: {
            latitude: 40.7522,
            longitude: -73.9818,
          },
          streetNames: ["W 40 ST", "5 AVE"],
          physicalIds: ["100", "101"],
        },
        boundary: {
          kind: "circle",
          radiusMeters: SERVER_RADIUS_METERS,
        },
        period: {
          startInclusive: SERVER_PERIOD_START,
          endExclusive: SERVER_PERIOD_END,
        },
      });
    }
  });
});

describe("invalid_request — malformed body shape", () => {
  it("rejects a non-object body", () => {
    expectRejected("not an object", "invalid_request");
  });

  it("rejects null", () => {
    expectRejected(null, "invalid_request");
  });

  it("rejects undefined", () => {
    expectRejected(undefined, "invalid_request");
  });

  it("rejects an array body", () => {
    expectRejected([validRequest()], "invalid_request");
  });

  it("rejects a missing schemaVersion", () => {
    const body = validRequest();
    delete body.schemaVersion;
    expectRejected(body, "invalid_request");
  });

  it("rejects a wrong schemaVersion", () => {
    expectRejected(validRequest({ schemaVersion: "2" }), "invalid_request");
  });

  it("rejects a missing selection", () => {
    const body = validRequest();
    delete body.selection;
    expectRejected(body, "invalid_request");
  });

  it("rejects a missing boundary", () => {
    const body = validRequest();
    delete body.boundary;
    expectRejected(body, "invalid_request");
  });

  it("rejects a missing period", () => {
    const body = validRequest();
    delete body.period;
    expectRejected(body, "invalid_request");
  });

  it("rejects a selection missing streetNames or physicalIds", () => {
    expectRejected(
      validRequest({
        selection: {
          kind: "intersection",
          displayName: "W 40 ST at 5 AVE",
          coordinate: { latitude: 40.7522, longitude: -73.9818 },
          physicalIds: ["100"],
        },
      }),
      "invalid_request",
    );
  });
});

describe("invalid_coordinate — coordinate validation", () => {
  it("rejects a missing coordinate", () => {
    const body = validRequest();
    const selection = { ...(body.selection as Record<string, unknown>) };
    delete selection.coordinate;
    expectRejected({ ...body, selection }, "invalid_coordinate");
  });

  it("rejects NaN latitude/longitude", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          coordinate: { latitude: Number.NaN, longitude: -73.9818 },
        },
      }),
      "invalid_coordinate",
    );
  });

  it("rejects non-finite latitude/longitude", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          coordinate: {
            latitude: 40.7522,
            longitude: Number.POSITIVE_INFINITY,
          },
        },
      }),
      "invalid_coordinate",
    );
  });

  it("rejects string-typed coordinates", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          coordinate: { latitude: "40.7522", longitude: "-73.9818" },
        },
      }),
      "invalid_coordinate",
    );
  });

  it("rejects latitude out of range", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          coordinate: { latitude: 91, longitude: -73.9818 },
        },
      }),
      "invalid_coordinate",
    );
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          coordinate: { latitude: -91, longitude: -73.9818 },
        },
      }),
      "invalid_coordinate",
    );
  });

  it("rejects longitude out of range", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          coordinate: { latitude: 40.7522, longitude: 181 },
        },
      }),
      "invalid_coordinate",
    );
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          coordinate: { latitude: 40.7522, longitude: -181 },
        },
      }),
      "invalid_coordinate",
    );
  });

  it("PRD §13: rejects a swapped lat/lng pair as invalid_coordinate", () => {
    // A coordinate-order mistake: longitude's real value (-73.98) placed in
    // the latitude field, and latitude's real value (40.75) placed in the
    // longitude field. Latitude -73.98 is out of the valid [-90, 90] range,
    // so this must be caught by range validation even though both raw
    // numbers "look like" plausible NYC coordinates.
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          coordinate: { latitude: -73.98, longitude: 40.75 },
        },
      }),
      "invalid_coordinate",
    );
  });
});

describe("unsupported_radius — radius validation and unit enforcement", () => {
  it("rejects a smaller radius", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle", radiusMeters: 25 } }),
      "unsupported_radius",
    );
  });

  it("rejects a larger radius", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle", radiusMeters: 100 } }),
      "unsupported_radius",
    );
  });

  it("rejects a zero radius", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle", radiusMeters: 0 } }),
      "unsupported_radius",
    );
  });

  it("rejects a negative radius", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle", radiusMeters: -50 } }),
      "unsupported_radius",
    );
  });

  it("rejects a missing radius", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle" } }),
      "unsupported_radius",
    );
  });

  it("rejects the string '50.0' — no string-to-number coercion", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle", radiusMeters: "50.0" } }),
      "unsupported_radius",
    );
  });

  it("rejects the string '50' — no string-to-number coercion", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle", radiusMeters: "50" } }),
      "unsupported_radius",
    );
  });

  it("PRD §13: rejects 164 (50 meters expressed in feet) as unsupported_radius", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle", radiusMeters: 164 } }),
      "unsupported_radius",
    );
  });

  it("PRD §13: rejects 0.00045 (roughly 50 meters expressed in degrees) as unsupported_radius", () => {
    expectRejected(
      validRequest({ boundary: { kind: "circle", radiusMeters: 0.00045 } }),
      "unsupported_radius",
    );
  });
});

describe("unsupported_period — period validation", () => {
  it("rejects a wrong start date", () => {
    expectRejected(
      validRequest({
        period: { startInclusive: "2024-01-01", endExclusive: "2026-01-01" },
      }),
      "unsupported_period",
    );
  });

  it("rejects a wrong end date", () => {
    expectRejected(
      validRequest({
        period: { startInclusive: "2025-01-01", endExclusive: "2025-12-31" },
      }),
      "unsupported_period",
    );
  });

  it("rejects a swapped start/end", () => {
    expectRejected(
      validRequest({
        period: { startInclusive: "2026-01-01", endExclusive: "2025-01-01" },
      }),
      "unsupported_period",
    );
  });

  it("rejects an equivalent-but-different ISO format for the start date", () => {
    expectRejected(
      validRequest({
        period: {
          startInclusive: "2025-01-01T00:00:00.000Z",
          endExclusive: "2026-01-01",
        },
      }),
      "unsupported_period",
    );
  });

  it("rejects an equivalent-but-different ISO format for the end date", () => {
    expectRejected(
      validRequest({
        period: {
          startInclusive: "2025-01-01",
          endExclusive: "2026-01-01T00:00:00.000Z",
        },
      }),
      "unsupported_period",
    );
  });

  it("rejects a missing period field", () => {
    expectRejected(
      validRequest({ period: { startInclusive: "2025-01-01" } }),
      "unsupported_period",
    );
  });
});

describe("unsupported_selection_kind — selection kind validation", () => {
  it("rejects a polygon selection kind", () => {
    expectRejected(
      validRequest({
        selection: { ...validRequest().selection, kind: "polygon" },
      }),
      "unsupported_selection_kind",
    );
  });

  it("rejects a segment selection kind", () => {
    expectRejected(
      validRequest({
        selection: { ...validRequest().selection, kind: "segment" },
      }),
      "unsupported_selection_kind",
    );
  });

  it("rejects a missing selection kind", () => {
    const selection = { ...validRequest().selection } as Record<
      string,
      unknown
    >;
    delete selection.kind;
    expectRejected(validRequest({ selection }), "unsupported_selection_kind");
  });
});

describe("raw_query_not_allowed — rejects raw-SoQL-shaped input", () => {
  it("rejects a top-level $where key", () => {
    expectRejected(
      validRequest({ $where: "physicalid='100'" }),
      "raw_query_not_allowed",
    );
  });

  it("rejects a top-level $select key", () => {
    expectRejected(
      validRequest({ $select: "the_geom" }),
      "raw_query_not_allowed",
    );
  });

  it("rejects a top-level query key", () => {
    expectRejected(
      validRequest({ query: "SELECT * FROM crashes" }),
      "raw_query_not_allowed",
    );
  });

  it("rejects a top-level soql key", () => {
    expectRejected(
      validRequest({ soql: "within_circle(the_geom, 40.75, -73.98, 50)" }),
      "raw_query_not_allowed",
    );
  });

  it("rejects a string field containing within_circle(", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          displayName: "within_circle(the_geom, 40.75, -73.98, 50)",
        },
      }),
      "raw_query_not_allowed",
    );
  });

  it("rejects a string field containing a SELECT statement", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          displayName: "SELECT * FROM crashes",
        },
      }),
      "raw_query_not_allowed",
    );
  });

  it("rejects a string field containing a SoQL comment marker", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          displayName: "W 40 ST -- DROP everything",
        },
      }),
      "raw_query_not_allowed",
    );
  });

  it("rejects a $where key nested inside selection", () => {
    expectRejected(
      validRequest({
        selection: {
          ...validRequest().selection,
          $where: "physicalid='100'",
        },
      }),
      "raw_query_not_allowed",
    );
  });

  it("rejects a $where key nested inside boundary", () => {
    expectRejected(
      validRequest({
        boundary: { kind: "circle", radiusMeters: 50, $where: "1=1" },
      }),
      "raw_query_not_allowed",
    );
  });
});

describe("authority — server-owned radius and period cannot be granted by the client", () => {
  it("returns the server's own radius constant even when the client supplies the correct value", () => {
    const result = validateReportRequest(
      validRequest({ boundary: { kind: "circle", radiusMeters: 50 } }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.boundary.radiusMeters).toBe(SERVER_RADIUS_METERS);
    }
  });

  it("returns the server's own period constants even when the client supplies the correct values", () => {
    const result = validateReportRequest(
      validRequest({
        period: {
          startInclusive: "2025-01-01",
          endExclusive: "2026-01-01",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.period.startInclusive).toBe(SERVER_PERIOD_START);
      expect(result.request.period.endExclusive).toBe(SERVER_PERIOD_END);
    }
  });
});

describe("error messages are user-safe", () => {
  it("never echoes raw SoQL, upstream response bodies, or a stack trace into the message", () => {
    const results = [
      validateReportRequest({ $where: "physicalid='100' -- inject" }),
      validateReportRequest("not an object"),
      validateReportRequest(
        validRequest({ boundary: { kind: "circle", radiusMeters: 999 } }),
      ),
      validateReportRequest(
        validRequest({
          period: {
            startInclusive: "bad-date",
            endExclusive: "2026-01-01",
          },
        }),
      ),
      validateReportRequest(
        validRequest({
          selection: { ...validRequest().selection, kind: "polygon" },
        }),
      ),
    ];

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).not.toMatch(/\$where/i);
        expect(result.message).not.toMatch(/select \*/i);
        expect(result.message).not.toMatch(/within_circle\(/i);
        expect(result.message).not.toMatch(/at Object\.<anonymous>/);
        expect(result.message).not.toMatch(/\.ts:\d+:\d+/);
      }
    }
  });
});
