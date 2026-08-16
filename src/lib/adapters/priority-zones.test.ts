import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// API surface under test (src/lib/adapters/priority-zones.ts, not yet built):
//
//   export function resolvePriorityZone(
//     coordinate: GeographicCoordinate,
//   ): Promise<PriorityZoneResult>
//
//   export function __resetPriorityZoneCache(): void
//     // Test-only seam. Clears the process-lifetime qzji-nvbd cache so each
//     // test can start from a known state without a real fetch. Never call
//     // this from application code.
//
// resolvePriorityZone fetches qzji-nvbd's 5 rows AT MOST ONCE per cache
// lifetime (long-lived, not per-request), then tests the request's 50m
// circle against each cached the_geom multipolygon with
// circleIntersectsPolygon (src/lib/geometry.ts). It returns only
// { status: "matched" | "not_matched" | "unavailable" } — never a zone
// name, ID, or borough, because qzji-nvbd has no such column (see
// docs/knowledge-base/dataset-priority-zones.md).
//
// Failure-caching decision: a fetch failure is NOT cached. An "unavailable"
// result must be retried on the next call, so a transient Socrata outage
// does not poison the process for its remaining lifetime. Only a
// successfully parsed row set is cached.
// ---------------------------------------------------------------------------

import {
  resolvePriorityZone,
  __resetPriorityZoneCache,
} from "./priority-zones";

const CENTER = { latitude: 40.752205375223, longitude: -73.981823738617 };
const FAR_AWAY = { latitude: 40.9, longitude: -73.5 };
const ANOTHER_FAR_AWAY = { latitude: 40.6, longitude: -74.2 };

// A single qzji-nvbd row whose the_geom multipolygon fully contains CENTER's
// 50m circle.
function containingZoneRow() {
  return {
    the_geom: {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [CENTER.longitude - 1, CENTER.latitude - 1],
            [CENTER.longitude + 1, CENTER.latitude - 1],
            [CENTER.longitude + 1, CENTER.latitude + 1],
            [CENTER.longitude - 1, CENTER.latitude + 1],
            [CENTER.longitude - 1, CENTER.latitude - 1],
          ],
        ],
      ],
    },
    sq_mi: "12.3",
    shape_leng: "45.6",
    shape_area: "78.9",
  };
}

// A single qzji-nvbd row whose the_geom multipolygon is nowhere near CENTER.
function disjointZoneRow(offset = 5) {
  return {
    the_geom: {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [CENTER.longitude + offset, CENTER.latitude + offset],
            [CENTER.longitude + offset + 0.001, CENTER.latitude + offset],
            [
              CENTER.longitude + offset + 0.001,
              CENTER.latitude + offset + 0.001,
            ],
            [CENTER.longitude + offset, CENTER.latitude + offset + 0.001],
            [CENTER.longitude + offset, CENTER.latitude + offset],
          ],
        ],
      ],
    },
    sq_mi: "3.4",
    shape_leng: "5.6",
    shape_area: "7.8",
  };
}

function fiveDisjointRows() {
  return [1, 2, 3, 4, 5].map((n) => disjointZoneRow(n * 3));
}

function response(
  body: unknown,
  init?: Partial<{ ok: boolean; status: number }>,
) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

describe("resolvePriorityZone", () => {
  beforeEach(() => {
    __resetPriorityZoneCache();
    vi.unstubAllGlobals();
    delete process.env.SOCRATA_APP_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns matched when the circle overlaps one of the 5 cached zone polygons", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response([...fiveDisjointRows().slice(0, 4), containingZoneRow()]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolvePriorityZone(CENTER);

    expect(result).toEqual({ status: "matched" });
  });

  it("returns not_matched when the circle overlaps none of the 5 cached zone polygons", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(fiveDisjointRows()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolvePriorityZone(CENTER);

    expect(result).toEqual({ status: "not_matched" });
  });

  it.each([
    [
      "a rejected fetch",
      () => vi.fn().mockRejectedValue(new Error("network down")),
    ],
    [
      "a non-ok HTTP response",
      () => vi.fn().mockResolvedValue(response([], { ok: false, status: 503 })),
    ],
    [
      "invalid JSON",
      () =>
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("Unexpected token");
          },
        } as unknown as Response),
    ],
    [
      "a non-array JSON body",
      () => vi.fn().mockResolvedValue(response({ not: "an array" })),
    ],
  ])(
    "returns unavailable and never throws for %s",
    async (_label, buildFetch) => {
      vi.stubGlobal("fetch", buildFetch());

      await expect(resolvePriorityZone(CENTER)).resolves.toEqual({
        status: "unavailable",
      });
    },
  );

  it("fetches qzji-nvbd at most once across multiple resolvePriorityZone calls within the cache lifetime", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(fiveDisjointRows()));
    vi.stubGlobal("fetch", fetchMock);

    await resolvePriorityZone(CENTER);
    await resolvePriorityZone(FAR_AWAY);
    await resolvePriorityZone(ANOTHER_FAR_AWAY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after __resetPriorityZoneCache clears the cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(fiveDisjointRows()));
    vi.stubGlobal("fetch", fetchMock);

    await resolvePriorityZone(CENTER);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    __resetPriorityZoneCache();
    await resolvePriorityZone(CENTER);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a fetch failure — a subsequent call retries instead of staying unavailable forever", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response([], { ok: false, status: 503 }))
      .mockResolvedValueOnce(response(fiveDisjointRows()));
    vi.stubGlobal("fetch", fetchMock);

    const first = await resolvePriorityZone(CENTER);
    expect(first).toEqual({ status: "unavailable" });

    const second = await resolvePriorityZone(CENTER);
    expect(second).toEqual({ status: "not_matched" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a result object with only a status key — structurally impossible to leak a zone name/ID/borough", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response([...fiveDisjointRows().slice(0, 4), containingZoneRow()]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolvePriorityZone(CENTER);

    expect(Object.keys(result)).toEqual(["status"]);
  });

  it("sends the SOCRATA_APP_TOKEN as an X-App-Token header when set", async () => {
    process.env.SOCRATA_APP_TOKEN = "test-token-123";
    const fetchMock = vi.fn().mockResolvedValue(response(fiveDisjointRows()));
    vi.stubGlobal("fetch", fetchMock);

    await resolvePriorityZone(CENTER);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-App-Token": "test-token-123" }),
      }),
    );
  });

  it("does not send an X-App-Token header when SOCRATA_APP_TOKEN is unset", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(fiveDisjointRows()));
    vi.stubGlobal("fetch", fetchMock);

    await resolvePriorityZone(CENTER);

    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(init?.headers).toBeUndefined();
  });
});
