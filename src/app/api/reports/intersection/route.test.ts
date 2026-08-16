// @vitest-environment node
/**
 * TDD red for Phase 2 Step 2.3 — POST /api/reports/intersection route
 * handler.
 *
 * This test file specifies the API surface `builder` must implement in
 * `./route.ts`:
 *
 *   export async function POST(request: Request): Promise<Response>
 *
 * Pipeline: parse JSON body -> `validateReportRequest` (src/lib/validation.ts)
 * -> on `ok: false`, return HTTP 400 with the exact contract error body
 * (never calling the centerline adapter) -> on `ok: true`, call
 * `resolveIntersectionSelection` (src/lib/adapters/centerline.ts) with the
 * validated `selection` -> `null` maps to HTTP 400 `intersection_not_found`
 * -> a thrown `CenterlineSourceError` maps to HTTP 503 `source_failure`
 * (`retryable: true`) -> otherwise assemble the placeholder HTTP 200 body.
 *
 * Expected placeholder HTTP 200 body shape (contract-shaped; `metrics`,
 * `priorityZone`, `limitations`, `notes`, and `sources` are filled in by
 * Steps 2.4-2.7, so this step's success response only needs the fields that
 * are already fully determined by validation + centerline resolution):
 *
 *   {
 *     schemaVersion: "1",
 *     selection: {
 *       kind: "intersection",
 *       displayName: <OFFICIAL resolved displayName>,
 *       coordinate: <OFFICIAL resolved coordinate>,
 *       streetNames: <OFFICIAL resolved streetNames>,
 *       physicalIds: <OFFICIAL resolved physicalIds>,
 *     },
 *     boundary: { kind: "circle", radiusMeters: SERVER_RADIUS_METERS },
 *     period: {
 *       startInclusive: SERVER_PERIOD_START,
 *       endExclusive: SERVER_PERIOD_END,
 *     },
 *   }
 *
 * `reportId`, `generatedAt`, `status`, `summary`, `metrics`, `priorityZone`,
 * `limitations`, `notes`, and `sources` are NOT asserted here — they land in
 * Steps 2.4-2.7. This test only pins down what is already fully determined
 * by this step's pipeline: schema version, the OFFICIAL resolved selection
 * (never the client's submitted strings), and the server-owned
 * boundary/period constants.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntersectionReportErrorResponse } from "../../../../types/report";
import {
  SERVER_PERIOD_END,
  SERVER_PERIOD_START,
  SERVER_RADIUS_METERS,
} from "../../../../lib/validation";
import {
  CenterlineSourceError,
  resolveIntersectionSelection,
} from "../../../../lib/adapters/centerline";

vi.mock("../../../../lib/adapters/centerline", () => ({
  resolveIntersectionSelection: vi.fn(),
  CenterlineSourceError: class CenterlineSourceError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CenterlineSourceError";
    }
  },
}));

const mockResolveIntersectionSelection = vi.mocked(
  resolveIntersectionSelection,
);

const OFFICIAL_RESOLVED = {
  displayName: "W 40 ST at 5 AVE",
  coordinate: { latitude: 40.7522, longitude: -73.9818 },
  streetNames: ["W 40 ST", "5 AVE"],
  physicalIds: ["183093", "200001"],
};

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "1",
    selection: {
      kind: "intersection",
      displayName: "SUBMITTED DISPLAY NAME",
      coordinate: { latitude: 40.7522, longitude: -73.9818 },
      streetNames: ["SUBMITTED ST", "SUBMITTED AVE"],
      physicalIds: ["999999"],
    },
    boundary: { kind: "circle", radiusMeters: 50 },
    period: { startInclusive: "2025-01-01", endExclusive: "2026-01-01" },
    ...overrides,
  };
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/reports/intersection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function importRoute() {
  return import("./route");
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("validation rejections round-trip through the real HTTP handler as HTTP 400", () => {
  const cases: Array<{
    name: string;
    body: unknown;
    code: IntersectionReportErrorResponse["error"]["code"];
  }> = [
    {
      name: "missing schemaVersion",
      body: (() => {
        const body = validBody();
        delete (body as Record<string, unknown>).schemaVersion;
        return body;
      })(),
      code: "invalid_request",
    },
    {
      name: "invalid coordinate outside the NYC bounding box",
      body: validBody({
        selection: {
          ...validBody().selection,
          coordinate: { latitude: 91, longitude: -73.9818 },
        },
      }),
      code: "invalid_coordinate",
    },
    {
      name: "unsupported radius",
      body: validBody({ boundary: { kind: "circle", radiusMeters: 25 } }),
      code: "unsupported_radius",
    },
    {
      name: "unsupported period",
      body: validBody({
        period: { startInclusive: "2024-01-01", endExclusive: "2025-01-01" },
      }),
      code: "unsupported_period",
    },
    {
      name: "unsupported selection kind",
      body: validBody({
        selection: { ...validBody().selection, kind: "polygon" },
      }),
      code: "unsupported_selection_kind",
    },
    {
      name: "raw query markers present in the request",
      body: validBody({ $where: "physicalid='100'" }),
      code: "raw_query_not_allowed",
    },
  ];

  for (const { name, body, code } of cases) {
    it(`returns HTTP 400 with the exact contract error body for ${name}`, async () => {
      const { POST } = await importRoute();

      const response = await POST(postRequest(body));

      expect(response.status).toBe(400);
      const json = (await response.json()) as IntersectionReportErrorResponse;
      expect(json).toEqual({
        schemaVersion: "1",
        error: {
          code,
          message: expect.any(String),
          retryable: false,
        },
      });
    });
  }
});

describe("malformed JSON body", () => {
  it("returns HTTP 400 invalid_request rather than a 500 when the body is unparseable JSON", async () => {
    const { POST } = await importRoute();

    const response = await POST(postRequest("{not json"));

    expect(response.status).toBe(400);
    const json = (await response.json()) as IntersectionReportErrorResponse;
    expect(json).toEqual({
      schemaVersion: "1",
      error: {
        code: "invalid_request",
        message: expect.any(String),
        retryable: false,
      },
    });
  });
});

describe("no side effects on rejection", () => {
  it("never calls resolveIntersectionSelection when validation fails", async () => {
    const { POST } = await importRoute();

    await POST(postRequest(validBody({ schemaVersion: "2" })));

    expect(mockResolveIntersectionSelection).not.toHaveBeenCalled();
  });
});

describe("intersection_not_found — resolution returns null", () => {
  it("returns HTTP 400 intersection_not_found when resolveIntersectionSelection resolves to null", async () => {
    mockResolveIntersectionSelection.mockResolvedValue(null);
    const { POST } = await importRoute();

    const response = await POST(postRequest(validBody()));

    expect(response.status).toBe(400);
    const json = (await response.json()) as IntersectionReportErrorResponse;
    expect(json).toEqual({
      schemaVersion: "1",
      error: {
        code: "intersection_not_found",
        message: expect.any(String),
        retryable: false,
      },
    });
  });
});

describe("source_failure — upstream centerline source failure", () => {
  it("returns HTTP 503 with retryable true when resolveIntersectionSelection throws CenterlineSourceError", async () => {
    mockResolveIntersectionSelection.mockRejectedValue(
      new CenterlineSourceError("NYC Street Centerline request failed."),
    );
    const { POST } = await importRoute();

    const response = await POST(postRequest(validBody()));

    expect(response.status).toBe(503);
    const json = (await response.json()) as IntersectionReportErrorResponse;
    expect(json).toEqual({
      schemaVersion: "1",
      error: {
        code: "source_failure",
        message: expect.any(String),
        retryable: true,
      },
    });
  });
});

describe("happy path — placeholder success response", () => {
  it("returns HTTP 200 with schemaVersion, the OFFICIAL resolved selection, and the server-owned boundary/period", async () => {
    mockResolveIntersectionSelection.mockResolvedValue(OFFICIAL_RESOLVED);
    const { POST } = await importRoute();

    const response = await POST(postRequest(validBody()));

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      schemaVersion: string;
      selection: {
        kind: string;
        displayName: string;
        coordinate: { latitude: number; longitude: number };
        streetNames: string[];
        physicalIds: string[];
      };
      boundary: { kind: string; radiusMeters: number };
      period: { startInclusive: string; endExclusive: string };
    };

    expect(json.schemaVersion).toBe("1");

    // The OFFICIAL resolved selection must be echoed back — never the
    // client's submitted (and here deliberately different) strings.
    expect(json.selection).toEqual({
      kind: "intersection",
      displayName: OFFICIAL_RESOLVED.displayName,
      coordinate: OFFICIAL_RESOLVED.coordinate,
      streetNames: OFFICIAL_RESOLVED.streetNames,
      physicalIds: OFFICIAL_RESOLVED.physicalIds,
    });
    expect(json.selection.displayName).not.toBe("SUBMITTED DISPLAY NAME");

    expect(json.boundary).toEqual({
      kind: "circle",
      radiusMeters: SERVER_RADIUS_METERS,
    });
    expect(json.period).toEqual({
      startInclusive: SERVER_PERIOD_START,
      endExclusive: SERVER_PERIOD_END,
    });
  });
});
