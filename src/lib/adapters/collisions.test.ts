/**
 * TDD red for Phase 2 Step 2.4 — server-side collisions adapter.
 *
 * This test file specifies the API surface `builder` must implement in
 * `src/lib/adapters/collisions.ts`:
 *
 * - `buildCollisionQueryUrl(coordinate: { latitude: number; longitude: number }): string`
 *     Builds the SoQL URL for the Motor Vehicle Collisions - Crashes dataset
 *     (`h9gi-nx95`). The `$where` clause hardcodes the server-owned 50-meter
 *     radius and the 2025 calendar-year date bounds — the radius and period
 *     are NEVER caller-supplied parameters, only the coordinate is. Also
 *     hardcodes `location IS NOT NULL` and NEVER filters/gates on `borough`
 *     (borough's ~30.5% null rate must not gate computation). `$select`
 *     requests only the documented report fields, and `$limit=5000` bounds
 *     the fetch so this is never an unbounded fetch-all-then-filter.
 *
 * - `CollisionRow` — a raw-ish typed row shape mirroring the Socrata response
 *     for the documented fields (see docs/knowledge-base/dataset-crashes.md).
 *     Numeric fields are typed as `string | null | undefined` because Socrata
 *     serializes numeric columns as JSON strings (e.g. `"3"`), and a field may
 *     be malformed (`"abc"`, `""`) or absent. This adapter does NOT parse,
 *     coerce, or aggregate these values — that is Step 2.5's job. Passing the
 *     raw string through unmodified (never coercing to `0`) is a deliberate
 *     boundary so 2.5 can apply the "malformed numeric -> null metric, never
 *     zero" rule from docs/contract.md.
 *
 * - `fetchCollisions(coordinate, options?): Promise<CollisionFetchResult>`
 *     Returns a typed RESULT UNION, never throws and never rejects. This is
 *     deliberately different from the centerline adapter's thrown
 *     `CenterlineSourceError`: per docs/contract.md, a degraded collision
 *     source must produce a `partial` HTTP 200 report with the affected
 *     metrics set to `null` — it must NOT fail the whole request. A typed,
 *     awaited result union lets the aggregation layer (Step 2.5) build a
 *     truthful partial report instead of an uncaught throw propagating into
 *     a 500 or crashing the request handler.
 *
 *     `CollisionFetchResult` =
 *       | { status: "available"; rows: CollisionRow[]; retrievedAt: string }
 *       | { status: "unavailable"; reason: "timeout" | "rate_limit" | "invalid_json" | "http_error"; retrievedAt: string }
 *
 *     A successful zero-row response is `{ status: "available", rows: [] }`
 *     — explicitly NOT an error and NOT `unavailable`. This is the whole
 *     null-vs-zero contract from docs/contract.md ("a successful zero-row
 *     response produces valid zero totals", vs. "an unavailable API produces
 *     a partial report, never zero crashes") and must never be conflated.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCollisionQueryUrl, fetchCollisions } from "./collisions";

const OFFICIAL_COORDINATE = { latitude: 40.7522, longitude: -73.9818 };

function response({
  ok = true,
  status = 200,
  json,
  jsonError,
}: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  jsonError?: unknown;
}) {
  return {
    ok,
    status,
    json: jsonError
      ? vi.fn().mockRejectedValue(jsonError)
      : vi.fn().mockResolvedValue(json),
  } as unknown as Response;
}

// PRD §12 fixture: W 40 ST at 5 AVE -> 6 rows, 7 injured, 1 killed.
function w40StRow(overrides: Record<string, unknown> = {}) {
  return {
    crash_date: "2025-03-14T00:00:00.000",
    crash_time: "8:15",
    borough: "MANHATTAN",
    zip_code: "10018",
    latitude: "40.7522",
    longitude: "-73.9818",
    location: {
      latitude: "40.7522",
      longitude: "-73.9818",
      human_address: '{"address":"","city":"","state":"","zip":""}',
    },
    on_street_name: "W 40 ST",
    off_street_name: "5 AVE",
    cross_street_name: null,
    number_of_persons_injured: "1",
    number_of_persons_killed: "0",
    number_of_pedestrians_injured: "1",
    number_of_pedestrians_killed: "0",
    number_of_cyclist_injured: "0",
    number_of_cyclist_killed: "0",
    number_of_motorist_injured: "0",
    number_of_motorist_killed: "0",
    contributing_factor_vehicle_1: "Driver Inattention/Distraction",
    contributing_factor_vehicle_2: "Unspecified",
    contributing_factor_vehicle_3: null,
    contributing_factor_vehicle_4: null,
    contributing_factor_vehicle_5: null,
    collision_id: "4700001",
    vehicle_type_code1: "Sedan",
    vehicle_type_code2: "Sedan",
    vehicle_type_code_3: null,
    vehicle_type_code_4: null,
    vehicle_type_code_5: null,
    ...overrides,
  };
}

function w40StFixtureRows(): unknown[] {
  return [
    w40StRow({ collision_id: "4700001", number_of_persons_injured: "1" }),
    w40StRow({ collision_id: "4700002", number_of_persons_injured: "1" }),
    w40StRow({ collision_id: "4700003", number_of_persons_injured: "1" }),
    w40StRow({ collision_id: "4700004", number_of_persons_injured: "1" }),
    w40StRow({ collision_id: "4700005", number_of_persons_injured: "1" }),
    w40StRow({
      collision_id: "4700006",
      number_of_persons_injured: "2",
      number_of_persons_killed: "1",
      number_of_pedestrians_injured: "0",
      number_of_pedestrians_killed: "1",
    }),
  ];
}

// PRD §12 fixture: E 42 ST at PARK AVE -> 9 rows, 3 missing on_street_name.
function e42StRow(overrides: Record<string, unknown> = {}) {
  return {
    crash_date: "2025-06-02T00:00:00.000",
    crash_time: "17:40",
    borough: null,
    zip_code: "10017",
    latitude: "40.7527",
    longitude: "-73.9772",
    location: {
      latitude: "40.7527",
      longitude: "-73.9772",
      human_address: '{"address":"","city":"","state":"","zip":""}',
    },
    on_street_name: "E 42 ST",
    off_street_name: "PARK AVE",
    cross_street_name: null,
    number_of_persons_injured: "0",
    number_of_persons_killed: "0",
    number_of_pedestrians_injured: "0",
    number_of_pedestrians_killed: "0",
    number_of_cyclist_injured: "0",
    number_of_cyclist_killed: "0",
    number_of_motorist_injured: "0",
    number_of_motorist_killed: "0",
    contributing_factor_vehicle_1: "Unspecified",
    contributing_factor_vehicle_2: null,
    contributing_factor_vehicle_3: null,
    contributing_factor_vehicle_4: null,
    contributing_factor_vehicle_5: null,
    collision_id: "4800001",
    vehicle_type_code1: "Sedan",
    vehicle_type_code2: null,
    vehicle_type_code_3: null,
    vehicle_type_code_4: null,
    vehicle_type_code_5: null,
    ...overrides,
  };
}

function e42StFixtureRows(): unknown[] {
  const rows: unknown[] = [];
  for (let i = 1; i <= 6; i += 1) {
    rows.push(e42StRow({ collision_id: `480000${i}` }));
  }
  // 3 rows missing on_street_name (use cross_street_name instead per the
  // documented mutual-exclusivity rule).
  for (let i = 7; i <= 9; i += 1) {
    rows.push(
      e42StRow({
        collision_id: `480000${i}`,
        on_street_name: null,
        off_street_name: null,
        cross_street_name: "E 42 ST",
      }),
    );
  }
  return rows;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SOCRATA_APP_TOKEN;
});

describe("buildCollisionQueryUrl", () => {
  it("scopes the $where clause to the server-owned 50m radius, 2025 date bounds, and location IS NOT NULL", () => {
    const url = new URL(buildCollisionQueryUrl(OFFICIAL_COORDINATE));
    const where = url.searchParams.get("$where");

    expect(where).toBeTruthy();
    expect(where).toContain(
      `within_circle(location, ${OFFICIAL_COORDINATE.latitude}, ${OFFICIAL_COORDINATE.longitude}, 50)`,
    );
    expect(where).toContain("crash_date >= '2025-01-01T00:00:00.000'");
    expect(where).toContain("crash_date < '2026-01-01T00:00:00.000'");
    expect(where).toContain("location IS NOT NULL");
  });

  it("hardcodes the radius to 50 regardless of coordinate values, and buildCollisionQueryUrl accepts only a coordinate (no radius parameter)", () => {
    // buildCollisionQueryUrl's declared signature takes only a coordinate —
    // there is no second "radius" argument for a caller to pass. This test
    // documents that constraint; passing a second argument here would be a
    // TypeScript compile error against the intended signature.
    const url = new URL(buildCollisionQueryUrl(OFFICIAL_COORDINATE));
    const where = url.searchParams.get("$where") ?? "";

    expect(where).toContain(", 50)");
    expect(buildCollisionQueryUrl).toHaveLength(1);
  });

  it("requests the documented report fields via $select and bounds the fetch with $limit=5000", () => {
    const url = new URL(buildCollisionQueryUrl(OFFICIAL_COORDINATE));
    const select = url.searchParams.get("$select");

    expect(select).toBeTruthy();
    const fields = (select ?? "").split(",").map((field) => field.trim());

    for (const expectedField of [
      "crash_date",
      "crash_time",
      "borough",
      "zip_code",
      "latitude",
      "longitude",
      "location",
      "on_street_name",
      "off_street_name",
      "cross_street_name",
      "number_of_persons_injured",
      "number_of_persons_killed",
      "number_of_pedestrians_injured",
      "number_of_pedestrians_killed",
      "number_of_cyclist_injured",
      "number_of_cyclist_killed",
      "number_of_motorist_injured",
      "number_of_motorist_killed",
      "contributing_factor_vehicle_1",
      "contributing_factor_vehicle_2",
      "contributing_factor_vehicle_3",
      "contributing_factor_vehicle_4",
      "contributing_factor_vehicle_5",
      "collision_id",
    ]) {
      expect(fields).toContain(expectedField);
    }

    expect(url.searchParams.get("$limit")).toBe("5000");
  });

  it("never gates the query on borough", () => {
    const url = new URL(buildCollisionQueryUrl(OFFICIAL_COORDINATE));
    const where = url.searchParams.get("$where") ?? "";
    const select = url.searchParams.get("$select") ?? "";

    expect(where.toLowerCase()).not.toContain("borough");
    // borough may legitimately be selected for display, but it must never
    // appear as a $where predicate.
    expect(where).not.toMatch(/borough\s*(IS|=)/i);
    void select;
  });
});

describe("fetchCollisions — success fixtures (PRD §12)", () => {
  it("returns all 6 rows for the W 40 ST at 5 AVE fixture", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ json: w40StFixtureRows() })),
    );

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.rows).toHaveLength(6);
      expect(typeof result.retrievedAt).toBe("string");
    }
  });

  it("returns all 9 rows for the E 42 ST at PARK AVE fixture, including the 3 rows missing on_street_name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ json: e42StFixtureRows() })),
    );

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.rows).toHaveLength(9);
      const missingLabelRows = result.rows.filter(
        (row: { on_street_name?: string | null }) => !row.on_street_name,
      );
      // Missing labels must NOT drop a row from the result.
      expect(missingLabelRows).toHaveLength(3);
      expect(result.rows).toHaveLength(9);
    }
  });
});

describe("fetchCollisions — zero rows vs. unavailable", () => {
  it("returns status 'available' with an empty rows array on a successful zero-row response, distinct from unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ json: [] })));

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.rows).toEqual([]);
    }
    // Explicitly not the unavailable/degraded shape.
    expect(result).not.toHaveProperty("reason");
  });
});

describe("fetchCollisions — malformed numeric passthrough", () => {
  it("passes malformed/empty/null numeric field values through unmodified instead of coercing to 0", async () => {
    const malformedRow = w40StRow({
      collision_id: "4700099",
      number_of_persons_injured: "abc",
      number_of_persons_killed: "",
      number_of_pedestrians_injured: null,
      number_of_cyclist_injured: undefined,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ json: [malformedRow] })),
    );

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.rows).toHaveLength(1);
      const [row] = result.rows;
      expect(row.number_of_persons_injured).toBe("abc");
      expect(row.number_of_persons_killed).toBe("");
      expect(row.number_of_pedestrians_injured).toBeNull();
      expect(row.number_of_cyclist_injured).toBeUndefined();
      // Never silently coerced to the number 0.
      expect(row.number_of_persons_injured).not.toBe(0);
    }
  });
});

describe("fetchCollisions — degraded source, never an uncaught throw", () => {
  it("resolves to status 'unavailable' with reason 'timeout' when fetch rejects with an AbortError", async () => {
    const abortError = new DOMException(
      "The operation was aborted",
      "AbortError",
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe("timeout");
    }
  });

  it("resolves to status 'unavailable' with reason 'rate_limit' on HTTP 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, status: 429, json: [] })),
    );

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe("rate_limit");
    }
  });

  it("resolves to status 'unavailable' with reason 'invalid_json' when response.json() rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({ jsonError: new SyntaxError("Unexpected token in JSON") }),
        ),
    );

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe("invalid_json");
    }
  });

  it("resolves to status 'unavailable' with reason 'http_error' on other non-ok HTTP statuses (e.g. 500)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, status: 500, json: [] })),
    );

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe("http_error");
    }
  });

  it("never rejects/throws across any degraded-source path", async () => {
    const cases = [
      () =>
        vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
      () =>
        vi
          .fn()
          .mockResolvedValue(response({ ok: false, status: 429, json: [] })),
      () =>
        vi
          .fn()
          .mockResolvedValue(
            response({ jsonError: new SyntaxError("bad json") }),
          ),
      () =>
        vi
          .fn()
          .mockResolvedValue(response({ ok: false, status: 500, json: [] })),
    ];

    for (const makeFetch of cases) {
      vi.stubGlobal("fetch", makeFetch());
      await expect(fetchCollisions(OFFICIAL_COORDINATE)).resolves.toBeDefined();
    }
  });
});

describe("fetchCollisions — Socrata app token header", () => {
  it("includes an X-App-Token header when SOCRATA_APP_TOKEN is set", async () => {
    process.env.SOCRATA_APP_TOKEN = "test-token-456";
    const fetchMock = vi.fn().mockResolvedValue(response({ json: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCollisions(OFFICIAL_COORDINATE);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "X-App-Token": "test-token-456" });
  });

  it("makes the request without an X-App-Token header when SOCRATA_APP_TOKEN is unset", async () => {
    delete process.env.SOCRATA_APP_TOKEN;
    const fetchMock = vi.fn().mockResolvedValue(response({ json: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCollisions(OFFICIAL_COORDINATE);

    expect(fetchMock).toHaveBeenCalled();
    expect(result.status).toBe("available");
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["X-App-Token"]).toBeUndefined();
  });
});
