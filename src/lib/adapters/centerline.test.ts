/**
 * TDD red for Phase 2 Step 2.1 — server-side centerline adapter.
 *
 * This test file specifies the API surface `builder` must implement in
 * `src/lib/adapters/centerline.ts`:
 *
 * - `buildIntersectionLookupUrl(coordinate: { latitude: number; longitude: number }, radiusMeters: number): string`
 *     Builds the SoQL URL used to look up eligible centerlines near a
 *     submitted coordinate. The `$where` clause MUST filter eligibility
 *     server-side (rw_type='1' AND blank nonped) — never fetch-all-then-filter.
 *
 *     LIVE-DATA BUG FIX (found by smoke testing on `feat/backend-report-api`):
 *     `inkn-q76z`'s `the_geom` is a MultiLineString. Socrata's
 *     `within_circle(the_geom, lat, lng, radius)` requires the ENTIRE
 *     geometry to be contained within the circle — a 50 m circle can never
 *     contain a whole street block, so `within_circle` returns ZERO rows
 *     against live data no matter how well-formed the query is. Verified
 *     live: `within_circle(..., 50)` -> 0 rows, `within_circle(..., 200)` ->
 *     9 rows, `within_circle(..., 1000)` -> 521 rows.
 *
 *     The fix is `intersects(the_geom, '<POLYGON WKT>')`, which has true
 *     intersection (touching-counts) semantics instead of containment. The
 *     query builds a small bounding-box polygon around the submitted
 *     coordinate (WKT vertex order is `lon lat`, NOT `lat lon` — PRD §13
 *     calls out swapped coordinate order as a class of bug this project
 *     tests for explicitly) and closes the ring by repeating the first
 *     vertex. This polygon is a LOOKUP WINDOW for finding nearby
 *     centerlines — it is NOT the same concept as the 50 m official
 *     intersection ANALYSIS boundary from ADR-0003. They currently share
 *     the same 50 m half-extent by coincidence of the verified fix, not by
 *     necessity — do not collapse them into "the same 50 m thing" in a
 *     future refactor; they answer different questions (what centerlines
 *     are near this point vs. what counts as inside the intersection for
 *     crash analysis).
 *
 * - `resolveIntersectionSelection(submitted: IntersectionSelection): Promise<ResolvedIntersection | null>`
 *     Re-derives an intersection candidate from live server data using only
 *     the submitted coordinate (and radius) as a lookup key. It NEVER trusts
 *     the submitted `displayName`, `streetNames`, or `physicalIds` — those are
 *     recomputed from eligible rows and grouped per Step 1.3's naming
 *     fallback (mirrors `groupIntersectionCandidates` in `../centerline-client`).
 *     Returns `null` when the coordinate resolves to zero or one eligible
 *     street name (ADR-0003's >=2 rule), or when nothing matches in current
 *     live data.
 *
 * - `ResolvedIntersection` — `{ displayName: string; coordinate: { latitude:
 *     number; longitude: number }; streetNames: string[]; physicalIds:
 *     string[] }`, always built from OFFICIAL server-derived values, never
 *     from the client's submitted strings.
 *
 * - `CenterlineSourceError` — a distinct error class/type thrown by
 *     `resolveIntersectionSelection` when the upstream SODA request itself
 *     fails (non-ok HTTP status or malformed body). This is DISTINGUISHABLE
 *     from "not found" (which resolves to `null`) because Step 2.3 maps
 *     not-found -> 400 `intersection_not_found` but a source failure -> 503
 *     `source_failure`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntersectionSelection } from "../../types/report";
import {
  buildIntersectionLookupUrl,
  resolveIntersectionSelection,
  CenterlineSourceError,
} from "./centerline";

const OFFICIAL_COORDINATE = { latitude: 40.7522, longitude: -73.9818 };

const OFFICIAL_ROW_183093 = {
  physicalid: "183093",
  rw_type: "1",
  nonped: "",
  from_level_code: "13",
  to_level_code: "13",
  full_street_name: "W  40 ST",
  street_name: "W 40 ST",
  stname_label: "W 40 ST",
  b5sc: "134570",
  bphys_id: "183093",
  globalid: "{GLOBAL-183093}",
  the_geom: {
    type: "MultiLineString",
    coordinates: [
      [
        [OFFICIAL_COORDINATE.longitude, OFFICIAL_COORDINATE.latitude],
        [-73.982, 40.7524],
      ],
    ],
  },
};

const OFFICIAL_ROW_5AVE = {
  physicalid: "200001",
  rw_type: "1",
  nonped: "",
  from_level_code: "13",
  to_level_code: "13",
  full_street_name: "5 AVENUE",
  street_name: "5 AVE",
  stname_label: "5 AVE",
  b5sc: null,
  bphys_id: null,
  globalid: null,
  the_geom: {
    type: "MultiLineString",
    coordinates: [
      [
        [OFFICIAL_COORDINATE.longitude, OFFICIAL_COORDINATE.latitude],
        [-73.9816, 40.7526],
      ],
    ],
  },
};

const OFFICIAL_ROW_AVE_OF_AMERICAS = {
  physicalid: "200002",
  rw_type: "1",
  nonped: "",
  from_level_code: "13",
  to_level_code: "13",
  full_street_name: "AVENUE OF THE AMERICAS",
  street_name: "AVE OF THE AMERICAS",
  stname_label: "AVE OF THE AMERICAS",
  b5sc: null,
  bphys_id: null,
  globalid: null,
  the_geom: {
    type: "MultiLineString",
    coordinates: [
      [
        [OFFICIAL_COORDINATE.longitude, OFFICIAL_COORDINATE.latitude],
        [-73.9819, 40.7527],
      ],
    ],
  },
};

const HIGHWAY_ROW = {
  ...OFFICIAL_ROW_5AVE,
  physicalid: "999999",
  rw_type: "2",
  street_name: "FDR DR",
  stname_label: "FDR DR",
};

function response({
  ok = true,
  status = 200,
  json,
}: {
  ok?: boolean;
  status?: number;
  json: unknown;
}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(json),
  } as unknown as Response;
}

function submittedSelection(
  overrides: Partial<IntersectionSelection> = {},
): IntersectionSelection {
  return {
    kind: "intersection",
    displayName: "W 40 ST at 5 AVE",
    coordinate: OFFICIAL_COORDINATE,
    streetNames: ["W 40 ST", "5 AVE"],
    physicalIds: ["183093", "200001"],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildIntersectionLookupUrl", () => {
  it("expresses the eligibility filter in the SoQL $where clause instead of fetching all rows", () => {
    const url = new URL(buildIntersectionLookupUrl(OFFICIAL_COORDINATE, 50));

    const where = url.searchParams.get("$where");
    expect(where).toBeTruthy();
    expect(where).toContain("rw_type='1'");
    expect(where).toMatch(/nonped\s+IS\s+NULL\s+OR\s+nonped\s*=\s*''/i);
  });

  it("scopes the query with intersects(the_geom, POLYGON(...)) — NOT within_circle, which returns zero rows against live MultiLineString data", () => {
    const url = new URL(buildIntersectionLookupUrl(OFFICIAL_COORDINATE, 50));
    const where = url.searchParams.get("$where");
    expect(where).toBeTruthy();

    // The fix: true intersection semantics via a polygon lookup window.
    expect(where).toContain("intersects(the_geom, 'POLYGON((");

    // Regression guard for the exact live-data bug: within_circle requires
    // the ENTIRE MultiLineString to fit inside the circle, which a 50 m
    // radius can never do for a street block, so it silently returns zero
    // rows. It must never reappear in the emitted $where clause.
    expect(where).not.toContain("within_circle");
  });

  it("emits WKT polygon vertices in lon lat order, not lat lon — a swapped order silently resolves to zero rows again", () => {
    const url = new URL(buildIntersectionLookupUrl(OFFICIAL_COORDINATE, 50));
    const where = url.searchParams.get("$where")!;

    const polygonMatch = where.match(/POLYGON\(\(([^)]+)\)\)/);
    expect(polygonMatch).not.toBeNull();

    const vertices = polygonMatch![1]
      .split(",")
      .map((pair) => pair.trim().split(/\s+/).map(Number));

    expect(vertices.length).toBeGreaterThanOrEqual(4);

    for (const [x, y] of vertices) {
      // x must be the longitude component (a small negative NYC longitude,
      // roughly -74), y must be the latitude component (a positive NYC
      // latitude, roughly 40) — asserting this ordering, not just that both
      // numbers are present, catches a swapped lat/lng WKT emission.
      expect(x).toBeLessThan(-70);
      expect(y).toBeGreaterThan(30);
    }
  });

  it("closes the polygon ring by repeating the first vertex as the last vertex", () => {
    const url = new URL(buildIntersectionLookupUrl(OFFICIAL_COORDINATE, 50));
    const where = url.searchParams.get("$where")!;

    const polygonMatch = where.match(/POLYGON\(\(([^)]+)\)\)/);
    expect(polygonMatch).not.toBeNull();

    const vertices = polygonMatch![1].split(",").map((pair) => pair.trim());

    expect(vertices.length).toBeGreaterThanOrEqual(4);
    expect(vertices[0]).toBe(vertices[vertices.length - 1]);
  });

  it("builds a bounding box around the submitted coordinate (the coordinate lies strictly inside the polygon's lon/lat extents)", () => {
    const url = new URL(buildIntersectionLookupUrl(OFFICIAL_COORDINATE, 50));
    const where = url.searchParams.get("$where")!;

    const polygonMatch = where.match(/POLYGON\(\(([^)]+)\)\)/);
    expect(polygonMatch).not.toBeNull();

    const vertices = polygonMatch![1]
      .split(",")
      .map((pair) => pair.trim().split(/\s+/).map(Number));

    const lons = vertices.map(([x]) => x);
    const lats = vertices.map(([, y]) => y);

    expect(Math.min(...lons)).toBeLessThan(OFFICIAL_COORDINATE.longitude);
    expect(Math.max(...lons)).toBeGreaterThan(OFFICIAL_COORDINATE.longitude);
    expect(Math.min(...lats)).toBeLessThan(OFFICIAL_COORDINATE.latitude);
    expect(Math.max(...lats)).toBeGreaterThan(OFFICIAL_COORDINATE.latitude);
  });

  it("documents that the lookup-window polygon is NOT the same concept as ADR-0003's 50 m official-intersection analysis boundary, even though both currently use 50 m", () => {
    // This is a documentation-style assertion, not a behavioral one: it
    // exists so that a future reader who greps for "50" doesn't collapse
    // the SODA lookup window (this file) with the analysis boundary used
    // downstream when computing which crashes count as "at this
    // intersection". They answer different questions and could diverge in
    // radius independently without either being wrong.
    const LOOKUP_WINDOW_RADIUS_METERS = 50;
    const ADR_0003_ANALYSIS_BOUNDARY_METERS = 50;
    expect(LOOKUP_WINDOW_RADIUS_METERS).toBe(ADR_0003_ANALYSIS_BOUNDARY_METERS);
  });
});

describe("resolveIntersectionSelection — positive resolution", () => {
  it("resolves physical ID 183093 against mocked rows to the official W 40 ST / 5 AVE / AVE OF THE AMERICAS record", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          json: [
            OFFICIAL_ROW_183093,
            OFFICIAL_ROW_5AVE,
            OFFICIAL_ROW_AVE_OF_AMERICAS,
          ],
        }),
      ),
    );

    const resolved = await resolveIntersectionSelection(
      submittedSelection({
        physicalIds: ["183093"],
      }),
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.physicalIds).toEqual(expect.arrayContaining(["183093"]));
    expect(resolved?.streetNames).toEqual(expect.arrayContaining(["W 40 ST"]));
    expect(resolved?.coordinate).toEqual(OFFICIAL_COORDINATE);
  });
});

describe("resolveIntersectionSelection — eligibility exclusions", () => {
  it("excludes a non-eligible rw_type (Highway=2) and returns null when only such rows are present at the coordinate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          json: [HIGHWAY_ROW, OFFICIAL_ROW_5AVE],
        }),
      ),
    );

    const resolved = await resolveIntersectionSelection(submittedSelection());

    // Only one eligible street name (5 AVE) remains once the Highway row is
    // excluded server-side, so the >=2 rule fails and this resolves to null.
    expect(resolved).toBeNull();
  });

  it("returns null when the coordinate's group holds only one eligible street name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          json: [OFFICIAL_ROW_183093],
        }),
      ),
    );

    const resolved = await resolveIntersectionSelection(submittedSelection());

    expect(resolved).toBeNull();
  });
});

describe("resolveIntersectionSelection — ADR-0003 security boundary", () => {
  it("never lets a falsified submitted displayName/streetNames survive into the resolved result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          json: [
            OFFICIAL_ROW_183093,
            OFFICIAL_ROW_5AVE,
            OFFICIAL_ROW_AVE_OF_AMERICAS,
          ],
        }),
      ),
    );

    const falsified = submittedSelection({
      displayName: "FAKE ST at NOT REAL AVE",
      streetNames: ["FAKE ST", "NOT REAL AVE"],
      physicalIds: ["000000", "111111"],
      coordinate: OFFICIAL_COORDINATE,
    });

    const resolved = await resolveIntersectionSelection(falsified);

    expect(resolved).not.toBeNull();
    // The official server-derived names must appear...
    expect(resolved?.streetNames).toEqual(expect.arrayContaining(["W 40 ST"]));
    // ...and the client's falsified strings must never survive.
    expect(resolved?.displayName).not.toContain("FAKE ST");
    expect(resolved?.displayName).not.toContain("NOT REAL AVE");
    expect(resolved?.streetNames).not.toContain("FAKE ST");
    expect(resolved?.streetNames).not.toContain("NOT REAL AVE");
    expect(resolved?.physicalIds).not.toContain("000000");
    expect(resolved?.physicalIds).not.toContain("111111");
  });
});

describe("resolveIntersectionSelection — stale or unmatched selection", () => {
  it("resolves to null when the submitted coordinate matches nothing in current live data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ json: [] })));

    const resolved = await resolveIntersectionSelection(submittedSelection());

    expect(resolved).toBeNull();
  });
});

describe("resolveIntersectionSelection — upstream source failure", () => {
  it("throws a distinguishable CenterlineSourceError (not null) on a non-ok HTTP response, so callers can map it to 503 instead of 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, status: 503, json: [] })),
    );

    await expect(
      resolveIntersectionSelection(submittedSelection()),
    ).rejects.toBeInstanceOf(CenterlineSourceError);
  });

  it("throws a CenterlineSourceError when the response body is not a valid array of rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ json: { unexpected: "shape" } })),
    );

    await expect(
      resolveIntersectionSelection(submittedSelection()),
    ).rejects.toBeInstanceOf(CenterlineSourceError);
  });

  it("throws a distinguishable CenterlineSourceError (not an unhandled rejection, not null) when fetch itself rejects with a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const result = resolveIntersectionSelection(submittedSelection());

    await expect(result).rejects.toBeInstanceOf(CenterlineSourceError);
    await expect(result).rejects.not.toBeNull();
  });

  it("wraps a non-Error rejection value (e.g. a thrown string) in a CenterlineSourceError with a stringified message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network exploded"));

    const result = resolveIntersectionSelection(submittedSelection());

    await expect(result).rejects.toBeInstanceOf(CenterlineSourceError);
    await expect(result).rejects.toThrow(/network exploded/);
  });
});

describe("resolveIntersectionSelection — Socrata app token header", () => {
  const originalToken = process.env.SOCRATA_APP_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.SOCRATA_APP_TOKEN;
    } else {
      process.env.SOCRATA_APP_TOKEN = originalToken;
    }
  });

  it("includes an X-App-Token header when SOCRATA_APP_TOKEN is set", async () => {
    process.env.SOCRATA_APP_TOKEN = "test-token-123";
    const fetchMock = vi.fn().mockResolvedValue(response({ json: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await resolveIntersectionSelection(submittedSelection());

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "X-App-Token": "test-token-123" },
      }),
    );
  });
});
