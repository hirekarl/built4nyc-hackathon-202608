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

/**
 * Phase 3 Step 3.2 — reconcile contract drift.
 *
 * Two additions per the live-data verification against real NYC Open Data
 * (both PRD §12 fixtures, no shape drift found):
 *
 *   1. Close the one branch the Phase 2 author flagged as uncovered: line
 *      62's `throw error` rethrow of a non-`CenterlineSourceError` escaping
 *      `resolveIntersectionSelection`. Only a *known* adapter failure
 *      (`CenterlineSourceError`) becomes the contract's 503 `source_failure`
 *      body; anything else must propagate rather than being silently folded
 *      into that same envelope.
 *   2. A contract-conformance guard driven from a realistic mocked adapter
 *      response shaped like the real live 200 body (multi-street normalized
 *      `displayName`, expanded `physicalIds`, `priorityZone.status:
 *      "matched"`), so a future backend edit can't silently drop/rename a
 *      field `ReportPanel`/`PrintReport` read without a test failing here.
 */

describe("non-CenterlineSourceError escaping the centerline adapter (Step 3.2)", () => {
  it("rethrows a plain Error rather than converting it to a 503 source_failure body", async () => {
    const unexpectedError = new Error("unexpected adapter crash");
    mockResolveIntersectionSelection.mockRejectedValue(unexpectedError);
    const { POST } = await importRoute();

    await expect(POST(postRequest(validBody()))).rejects.toBe(unexpectedError);
  });
});

describe("contract-conformance guard — HTTP 200 body matches docs/contract.md exactly (Step 3.2)", () => {
  // Shaped like the real live response documented for PRD §12 fixture 2
  // (E 42 ST at PARK AVE): a multi-street normalized displayName, an
  // EXPANDED physicalIds array (not an echo of the client's submitted one),
  // and priorityZone.status "matched" with NO zone name/id/borough field —
  // the Priority Zone dataset has no such column, so the contract forbids
  // one leaking through.
  const LIVE_SHAPED_RESOLVED = {
    displayName: "PARK AVE at E 42 ST",
    coordinate: { latitude: 40.7527, longitude: -73.9772 },
    streetNames: ["PARK AVE", "E 42 ST"],
    physicalIds: ["148625", "73419", "73416"],
  };

  function e42AtParkAveFixtureRows(): CollisionRow[] {
    // PRD §12 fixture 2: 9 crashes, 4 injured, 0 killed, 2 pedestrians
    // injured, 2 cyclists injured, 0 motorists injured/killed, with 3 of 9
    // records missing on_street_name (the documented data-quality
    // limitation) and 6 of 9 recording the literal factor value NYPD uses
    // for "Unspecified" (documented live unspecifiedFactors: 6, no named
    // contributing factor documented for this fixture, hence
    // contributingFactors: [] below).
    return [
      collisionRow({
        collision_id: "5800001",
        number_of_persons_injured: "1",
        number_of_pedestrians_injured: "1",
        contributing_factor_vehicle_1: "Unspecified",
      }),
      collisionRow({
        collision_id: "5800002",
        number_of_persons_injured: "1",
        number_of_pedestrians_injured: "1",
        contributing_factor_vehicle_1: "Unspecified",
      }),
      collisionRow({
        collision_id: "5800003",
        number_of_persons_injured: "1",
        number_of_cyclist_injured: "1",
        contributing_factor_vehicle_1: "Unspecified",
      }),
      collisionRow({
        collision_id: "5800004",
        number_of_persons_injured: "1",
        number_of_cyclist_injured: "1",
        contributing_factor_vehicle_1: "Unspecified",
      }),
      collisionRow({
        collision_id: "5800005",
        contributing_factor_vehicle_1: "Unspecified",
      }),
      collisionRow({
        collision_id: "5800006",
        on_street_name: null,
        contributing_factor_vehicle_1: "Unspecified",
      }),
      collisionRow({
        collision_id: "5800007",
        on_street_name: null,
      }),
      collisionRow({
        collision_id: "5800008",
        on_street_name: null,
      }),
      collisionRow({ collision_id: "5800009" }),
    ];
  }

  it("returns exactly the contract's required field paths, with correct types/enums, no leaked Priority Zone identity fields, and the documented normalization", async () => {
    mockResolveIntersectionSelection.mockResolvedValue(LIVE_SHAPED_RESOLVED);
    mockFetchCollisions.mockResolvedValue({
      status: "available",
      rows: e42AtParkAveFixtureRows(),
      retrievedAt: DEFAULT_RETRIEVED_AT,
    });
    mockResolvePriorityZone.mockResolvedValue({ status: "matched" });

    const { POST } = await importRoute();
    const response = await POST(
      postRequest(
        validBody({
          selection: {
            kind: "intersection",
            displayName: "SUBMITTED DISPLAY NAME",
            coordinate: { latitude: 40.7527, longitude: -73.9772 },
            streetNames: ["SUBMITTED ST", "SUBMITTED AVE"],
            physicalIds: ["999999"],
          },
        }),
      ),
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as Record<string, unknown>;

    // --- exact top-level key set (no extra, no missing) ---
    expect(Object.keys(json).sort()).toEqual(
      [
        "schemaVersion",
        "reportId",
        "generatedAt",
        "status",
        "summary",
        "selection",
        "boundary",
        "period",
        "metrics",
        "priorityZone",
        "limitations",
        "notes",
        "sources",
      ].sort(),
    );

    // --- schemaVersion / status / core scalar types ---
    expect(json.schemaVersion).toBe("1");
    expect(typeof json.reportId).toBe("string");
    expect((json.reportId as string).length).toBeGreaterThan(0);
    expect(typeof json.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(json.generatedAt as string))).toBe(false);
    expect(["complete", "partial"]).toContain(json.status);
    expect(typeof json.summary).toBe("string");

    // --- selection: exact keys, OFFICIAL normalized values (never the
    // client-submitted ones), including the documented multi-street
    // displayName and expanded physicalIds normalization ---
    const selection = json.selection as Record<string, unknown>;
    expect(Object.keys(selection).sort()).toEqual(
      [
        "kind",
        "displayName",
        "coordinate",
        "streetNames",
        "physicalIds",
      ].sort(),
    );
    expect(selection.kind).toBe("intersection");
    expect(selection.displayName).toBe(LIVE_SHAPED_RESOLVED.displayName);
    expect(selection.displayName).not.toBe("SUBMITTED DISPLAY NAME");
    expect(selection.coordinate).toEqual(LIVE_SHAPED_RESOLVED.coordinate);
    expect(selection.streetNames).toEqual(LIVE_SHAPED_RESOLVED.streetNames);
    expect(selection.physicalIds).toEqual(LIVE_SHAPED_RESOLVED.physicalIds);
    expect((selection.physicalIds as string[]).length).toBeGreaterThan(1);

    // --- boundary / period: server-owned, never client-supplied ---
    expect(json.boundary).toEqual({ kind: "circle", radiusMeters: 50 });
    expect(json.period).toEqual({
      startInclusive: "2025-01-01",
      endExclusive: "2026-01-01",
    });

    // --- metrics: exact keys, correct types, the fixture's exact numbers ---
    const metrics = json.metrics as Record<string, unknown>;
    expect(Object.keys(metrics).sort()).toEqual(
      [
        "crashes",
        "peopleInjured",
        "peopleKilled",
        "pedestriansInjured",
        "pedestriansKilled",
        "cyclistsInjured",
        "cyclistsKilled",
        "motoristsInjured",
        "motoristsKilled",
        "contributingFactors",
        "unspecifiedFactors",
      ].sort(),
    );
    expect(metrics).toEqual({
      crashes: 9,
      peopleInjured: 4,
      peopleKilled: 0,
      pedestriansInjured: 2,
      pedestriansKilled: 0,
      cyclistsInjured: 2,
      cyclistsKilled: 0,
      motoristsInjured: 0,
      motoristsKilled: 0,
      contributingFactors: [],
      unspecifiedFactors: 6,
    });
    expect(Array.isArray(metrics.contributingFactors)).toBe(true);

    // --- priorityZone: exactly {status}, one of the three literals, and NO
    // leaked zone identity field (name/id/borough are forbidden — the
    // Priority Zone dataset has no such column) ---
    const priorityZone = json.priorityZone as Record<string, unknown>;
    expect(Object.keys(priorityZone)).toEqual(["status"]);
    expect(["matched", "not_matched", "unavailable"]).toContain(
      priorityZone.status,
    );
    expect(priorityZone.status).toBe("matched");
    for (const forbiddenKey of [
      "name",
      "zoneName",
      "id",
      "zoneId",
      "borough",
    ]) {
      expect(priorityZone).not.toHaveProperty(forbiddenKey);
    }

    // --- limitations / notes: string arrays, disclosing the documented
    // missing on_street_name limitation for this fixture ---
    expect(Array.isArray(json.limitations)).toBe(true);
    for (const limitation of json.limitations as unknown[]) {
      expect(typeof limitation).toBe("string");
    }
    expect(json.limitations).toEqual([
      "3 of 9 crash records are missing on_street_name.",
    ]);
    expect(Array.isArray(json.notes)).toBe(true);
    for (const note of json.notes as unknown[]) {
      expect(typeof note).toBe("string");
    }

    // --- sources: exact required datasets, roles, and shape ---
    const sources = json.sources as Array<Record<string, unknown>>;
    expect(Array.isArray(sources)).toBe(true);
    expect(sources).toHaveLength(3);
    for (const source of sources) {
      expect(Object.keys(source).sort()).toEqual(
        [
          "name",
          "datasetId",
          "url",
          "role",
          "retrievalStatus",
          "retrievedAt",
          "queryDescription",
        ].sort(),
      );
      expect(["inkn-q76z", "h9gi-nx95", "qzji-nvbd"]).toContain(
        source.datasetId,
      );
      expect([
        "selection_geometry",
        "collision_metrics",
        "priority_context",
      ]).toContain(source.role);
      expect(["available", "unavailable"]).toContain(source.retrievalStatus);
      expect(typeof source.name).toBe("string");
      expect(typeof source.url).toBe("string");
      expect(typeof source.queryDescription).toBe("string");
    }
    expect(sources.map((source) => source.datasetId).sort()).toEqual(
      ["inkn-q76z", "h9gi-nx95", "qzji-nvbd"].sort(),
    );
  });
});
