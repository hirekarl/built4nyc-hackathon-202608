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
    // Must scope the query to the submitted coordinate — never a bare "give me everything".
    expect(where).toMatch(/within_circle|distance_in_meters/i);
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
