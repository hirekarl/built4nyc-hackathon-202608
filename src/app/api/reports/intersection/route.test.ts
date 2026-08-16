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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IntersectionReport,
  IntersectionReportErrorResponse,
} from "../../../../types/report";
import {
  SERVER_PERIOD_END,
  SERVER_PERIOD_START,
  SERVER_RADIUS_METERS,
} from "../../../../lib/validation";
import {
  CenterlineSourceError,
  resolveIntersectionSelection,
} from "../../../../lib/adapters/centerline";
import { fetchCollisions } from "../../../../lib/adapters/collisions";
import { resolvePriorityZone } from "../../../../lib/adapters/priority-zones";
import type { CollisionRow } from "../../../../lib/adapters/collisions";

vi.mock("../../../../lib/adapters/centerline", () => ({
  resolveIntersectionSelection: vi.fn(),
  CenterlineSourceError: class CenterlineSourceError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CenterlineSourceError";
    }
  },
}));

vi.mock("../../../../lib/adapters/collisions", () => ({
  fetchCollisions: vi.fn(),
}));

vi.mock("../../../../lib/adapters/priority-zones", () => ({
  resolvePriorityZone: vi.fn(),
}));

const mockResolveIntersectionSelection = vi.mocked(
  resolveIntersectionSelection,
);
const mockFetchCollisions = vi.mocked(fetchCollisions);
const mockResolvePriorityZone = vi.mocked(resolvePriorityZone);

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

const DEFAULT_RETRIEVED_AT = "2026-01-01T00:00:00.000Z";

afterEach(() => {
  vi.clearAllMocks();
});

// Step 2.7 wires `fetchCollisions`/`resolvePriorityZone` into the success
// path. Every test in this file gets a harmless, "available" default so
// pre-2.7 tests (which never asserted on collision/Priority Zone behavior)
// keep passing once the route actually calls these adapters. Tests that
// care about a specific collision/Priority Zone result override the mock
// explicitly.
beforeEach(() => {
  mockFetchCollisions.mockResolvedValue({
    status: "available",
    rows: [],
    retrievedAt: DEFAULT_RETRIEVED_AT,
  });
  mockResolvePriorityZone.mockResolvedValue({ status: "not_matched" });
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

/**
 * TDD red for Phase 2 Step 2.7 — full report assembly wired into the route's
 * success path, replacing Step 2.3's placeholder body.
 */

function collisionRow(overrides: Partial<CollisionRow> = {}): CollisionRow {
  return {
    crash_date: "2025-03-14T00:00:00.000",
    crash_time: "8:15",
    borough: "MANHATTAN",
    zip_code: "10018",
    latitude: "40.7522",
    longitude: "-73.9818",
    location: { latitude: "40.7522", longitude: "-73.9818" },
    on_street_name: "W 40 ST",
    off_street_name: "5 AVE",
    cross_street_name: null,
    number_of_persons_injured: "0",
    number_of_persons_killed: "0",
    number_of_pedestrians_injured: "0",
    number_of_pedestrians_killed: "0",
    number_of_cyclist_injured: "0",
    number_of_cyclist_killed: "0",
    number_of_motorist_injured: "0",
    number_of_motorist_killed: "0",
    contributing_factor_vehicle_1: null,
    contributing_factor_vehicle_2: null,
    contributing_factor_vehicle_3: null,
    contributing_factor_vehicle_4: null,
    contributing_factor_vehicle_5: null,
    collision_id: "4700000",
    vehicle_type_code1: "Sedan",
    vehicle_type_code2: null,
    vehicle_type_code_3: null,
    vehicle_type_code_4: null,
    vehicle_type_code_5: null,
    ...overrides,
  };
}

// PRD §12 fixture 1: W 40 ST at 5 AVE — 6 crashes, 7 people injured, 1
// killed, 4 pedestrians injured, 1 killed, 1 cyclist injured, 2 motorists
// injured. Duplicated locally (route.test.ts intentionally does not import
// non-exported helpers from report.test.ts) so this file stays self
// contained.
function w40At5AveFixtureRows(): CollisionRow[] {
  return [
    collisionRow({
      collision_id: "4700001",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
    }),
    collisionRow({
      collision_id: "4700002",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
    }),
    collisionRow({
      collision_id: "4700003",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
    }),
    collisionRow({
      collision_id: "4700004",
      number_of_persons_injured: "0",
      number_of_persons_killed: "1",
      number_of_pedestrians_injured: "0",
      number_of_pedestrians_killed: "1",
    }),
    collisionRow({
      collision_id: "4700005",
      number_of_persons_injured: "1",
      number_of_pedestrians_injured: "1",
    }),
    collisionRow({
      collision_id: "4700006",
      number_of_persons_injured: "3",
      number_of_cyclist_injured: "1",
      number_of_motorist_injured: "2",
    }),
  ];
}

describe("full report assembly — HTTP 200 success body (Step 2.7)", () => {
  it("returns the FULL report body (not the Step 2.3 placeholder), and the W 40 ST at 5 AVE fixture's exact numbers survive the whole route", async () => {
    mockResolveIntersectionSelection.mockResolvedValue(OFFICIAL_RESOLVED);
    mockFetchCollisions.mockResolvedValue({
      status: "available",
      rows: w40At5AveFixtureRows(),
      retrievedAt: DEFAULT_RETRIEVED_AT,
    });
    mockResolvePriorityZone.mockResolvedValue({ status: "not_matched" });

    const { POST } = await importRoute();
    const response = await POST(postRequest(validBody()));

    expect(response.status).toBe(200);
    const json = (await response.json()) as IntersectionReport;

    expect(json.status).toBe("complete");
    expect(json.metrics).toEqual({
      crashes: 6,
      peopleInjured: 7,
      peopleKilled: 1,
      pedestriansInjured: 4,
      pedestriansKilled: 1,
      cyclistsInjured: 1,
      cyclistsKilled: 0,
      motoristsInjured: 2,
      motoristsKilled: 0,
      contributingFactors: [],
      unspecifiedFactors: 0,
    });
    expect(json.priorityZone).toEqual({ status: "not_matched" });
    expect(json.sources).toHaveLength(3);
    expect(json.limitations).toEqual([]);
    expect(typeof json.reportId).toBe("string");
    expect(json.reportId.length).toBeGreaterThan(0);
  });

  it("returns HTTP 200 with status 'partial' (never 503) when the collision source is unavailable", async () => {
    mockResolveIntersectionSelection.mockResolvedValue(OFFICIAL_RESOLVED);
    mockFetchCollisions.mockResolvedValue({
      status: "unavailable",
      reason: "timeout",
      retrievedAt: DEFAULT_RETRIEVED_AT,
    });
    mockResolvePriorityZone.mockResolvedValue({ status: "matched" });

    const { POST } = await importRoute();
    const response = await POST(postRequest(validBody()));

    expect(response.status).toBe(200);
    const json = (await response.json()) as IntersectionReport;
    expect(json.status).toBe("partial");
    expect(json.metrics.crashes).toBeNull();
  });

  it("returns HTTP 200 with status 'partial' when the Priority Zone source is unavailable", async () => {
    mockResolveIntersectionSelection.mockResolvedValue(OFFICIAL_RESOLVED);
    mockFetchCollisions.mockResolvedValue({
      status: "available",
      rows: [],
      retrievedAt: DEFAULT_RETRIEVED_AT,
    });
    mockResolvePriorityZone.mockResolvedValue({ status: "unavailable" });

    const { POST } = await importRoute();
    const response = await POST(postRequest(validBody()));

    expect(response.status).toBe(200);
    const json = (await response.json()) as IntersectionReport;
    expect(json.status).toBe("partial");
    expect(json.priorityZone).toEqual({ status: "unavailable" });
  });

  it("returns a valid ISO 8601 generatedAt and a non-empty reportId on the real response", async () => {
    mockResolveIntersectionSelection.mockResolvedValue(OFFICIAL_RESOLVED);
    mockFetchCollisions.mockResolvedValue({
      status: "available",
      rows: [],
      retrievedAt: DEFAULT_RETRIEVED_AT,
    });
    mockResolvePriorityZone.mockResolvedValue({ status: "not_matched" });

    const { POST } = await importRoute();
    const response = await POST(postRequest(validBody()));
    const json = (await response.json()) as IntersectionReport;

    expect(typeof json.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(json.generatedAt))).toBe(false);
    expect(typeof json.reportId).toBe("string");
    expect(json.reportId.length).toBeGreaterThan(0);
  });

  it("re-asserts at the integration layer that the response selection is the OFFICIAL resolved one, never the client-submitted one", async () => {
    mockResolveIntersectionSelection.mockResolvedValue(OFFICIAL_RESOLVED);
    mockFetchCollisions.mockResolvedValue({
      status: "available",
      rows: [],
      retrievedAt: DEFAULT_RETRIEVED_AT,
    });
    mockResolvePriorityZone.mockResolvedValue({ status: "not_matched" });

    const { POST } = await importRoute();
    const response = await POST(postRequest(validBody()));
    const json = (await response.json()) as IntersectionReport;

    expect(json.selection).toEqual({
      kind: "intersection",
      displayName: OFFICIAL_RESOLVED.displayName,
      coordinate: OFFICIAL_RESOLVED.coordinate,
      streetNames: OFFICIAL_RESOLVED.streetNames,
      physicalIds: OFFICIAL_RESOLVED.physicalIds,
    });
    expect(json.selection.displayName).not.toBe("SUBMITTED DISPLAY NAME");
  });
});
