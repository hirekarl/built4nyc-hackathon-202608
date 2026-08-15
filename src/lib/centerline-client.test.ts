import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCenterlineUrl,
  candidatesFeatureCollection,
  centerlinesFeatureCollection,
  fetchEligibleCenterlines,
  groupIntersectionCandidates,
  normalizeCenterlineRows,
  type NormalizedCenterline,
} from "./centerline-client";

const BOUNDS = {
  north: 40.76,
  west: -73.99,
  south: 40.74,
  east: -73.97,
};

const NODE = [-73.9818, 40.7522] as [number, number];

function centerlineRow(overrides: Record<string, unknown> = {}) {
  return {
    physicalid: "100",
    rw_type: "1",
    from_level_code: "13",
    to_level_code: "13",
    full_street_name: "W  40 ST",
    stname_label: "W 40 ST",
    the_geom: {
      type: "MultiLineString",
      coordinates: [[NODE, [-73.982, 40.7524]]],
    },
    ...overrides,
  };
}

function normalizedCenterline(
  overrides: Partial<NormalizedCenterline> = {},
): NormalizedCenterline {
  return {
    physicalId: "100",
    streetName: "W 40 ST",
    fromLevel: "13",
    toLevel: "13",
    geometry: {
      type: "MultiLineString",
      coordinates: [[NODE, [-73.982, 40.7524]]],
    },
    b5sc: null,
    bPhysId: null,
    globalId: null,
    ...overrides,
  };
}

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("centerline URL validation", () => {
  it("keeps the documented viewport query and rejects every invalid bound class", () => {
    const url = new URL(buildCenterlineUrl(BOUNDS));

    expect(url.searchParams.get("$where")).toContain(
      "within_box(the_geom, 40.76, -73.99, 40.74, -73.97)",
    );
    expect(url.searchParams.get("$where")).toContain("rw_type='1'");
    expect(url.searchParams.get("$where")).toContain(
      "nonped IS NULL OR nonped=''",
    );

    for (const bounds of [
      { ...BOUNDS, north: Number.POSITIVE_INFINITY },
      { ...BOUNDS, south: -91 },
      { ...BOUNDS, north: 91 },
      { ...BOUNDS, west: -181 },
      { ...BOUNDS, east: 181 },
      { ...BOUNDS, north: BOUNDS.south },
      { ...BOUNDS, east: BOUNDS.west },
    ]) {
      expect(() => buildCenterlineUrl(bounds)).toThrow(/invalid.*bounds/i);
    }
  });
});

describe("centerline row normalization", () => {
  it("uses the official label first, falls back to the full name, and normalizes whitespace", () => {
    const rows = normalizeCenterlineRows([
      centerlineRow({
        physicalid: " label ",
        stname_label: "  WEST   40   STREET  ",
        full_street_name: "IGNORED NAME",
      }),
      centerlineRow({
        physicalid: "fallback",
        stname_label: "   ",
        full_street_name: "  FIFTH    AVENUE  ",
      }),
    ]);

    expect(
      rows.map(({ physicalId, streetName }) => ({ physicalId, streetName })),
    ).toEqual([
      { physicalId: "label", streetName: "WEST 40 STREET" },
      { physicalId: "fallback", streetName: "FIFTH AVENUE" },
    ]);
  });

  it("normalizes optional metadata without inventing missing values", () => {
    const [present, missing] = normalizeCenterlineRows([
      centerlineRow({
        physicalid: "present",
        b5sc: " 134570 ",
        bphys_id: " B-PHYS ",
        globalid: " GLOBAL ",
      }),
      centerlineRow({
        physicalid: "missing",
        b5sc: " ",
        bphys_id: 42,
        globalid: undefined,
      }),
    ]);

    expect(present).toMatchObject({
      b5sc: "134570",
      bPhysId: "B-PHYS",
      globalId: "GLOBAL",
    });
    expect(missing).toMatchObject({
      b5sc: null,
      bPhysId: null,
      globalId: null,
    });
  });

  it("accepts only rw_type 1 with undefined, null, or blank nonped", () => {
    const accepted = [undefined, null, ""].map((nonped, index) =>
      centerlineRow({ physicalid: `accepted-${index}`, nonped }),
    );
    const rejected = [
      centerlineRow({ physicalid: "wrong-rw", rw_type: "2" }),
      centerlineRow({ physicalid: "missing-rw", rw_type: undefined }),
      centerlineRow({ physicalid: "vehicle", nonped: "V" }),
      centerlineRow({ physicalid: "designated", nonped: "D" }),
      centerlineRow({ physicalid: "space", nonped: " " }),
    ];

    expect(
      normalizeCenterlineRows([...accepted, ...rejected]).map(
        ({ physicalId }) => physicalId,
      ),
    ).toEqual(["accepted-0", "accepted-1", "accepted-2"]);
  });

  it("rejects non-records and rows missing IDs, levels, names, or geometry", () => {
    const invalidRows = [
      null,
      [],
      centerlineRow({ physicalid: "" }),
      centerlineRow({ physicalid: 100 }),
      centerlineRow({ from_level_code: undefined }),
      centerlineRow({ from_level_code: null }),
      centerlineRow({ to_level_code: 13 }),
      centerlineRow({ stname_label: "", full_street_name: "" }),
      centerlineRow({ the_geom: null }),
    ];

    expect(normalizeCenterlineRows(invalidRows)).toEqual([]);
  });

  it("rejects malformed or empty MultiLineStrings and invalid coordinates", () => {
    const invalidGeometries = [
      "not-an-object",
      { type: "LineString", coordinates: [[NODE, NODE]] },
      { type: "MultiLineString", coordinates: null },
      { type: "MultiLineString", coordinates: [] },
      { type: "MultiLineString", coordinates: [null] },
      { type: "MultiLineString", coordinates: [[NODE]] },
      { type: "MultiLineString", coordinates: [[[0]]] },
      { type: "MultiLineString", coordinates: [[["-73.9", 40.7], NODE]] },
      { type: "MultiLineString", coordinates: [[[Number.NaN, 40.7], NODE]] },
      {
        type: "MultiLineString",
        coordinates: [[[Number.POSITIVE_INFINITY, 40.7], NODE]],
      },
      { type: "MultiLineString", coordinates: [[[-181, 40.7], NODE]] },
      { type: "MultiLineString", coordinates: [[[181, 40.7], NODE]] },
      { type: "MultiLineString", coordinates: [[[-73.9, -91], NODE]] },
      { type: "MultiLineString", coordinates: [[[-73.9, 91], NODE]] },
    ];

    expect(
      normalizeCenterlineRows(
        invalidGeometries.map((the_geom, index) =>
          centerlineRow({ physicalid: `invalid-${index}`, the_geom }),
        ),
      ),
    ).toEqual([]);
  });

  it("keeps valid lines and valid coordinate range boundaries while dropping malformed sibling lines", () => {
    const result = normalizeCenterlineRows([
      centerlineRow({
        the_geom: {
          type: "MultiLineString",
          coordinates: [
            [[-73.9, 40.7]],
            [
              [-180, -90],
              [180, 90],
            ],
          ],
        },
      }),
    ]);

    expect(result[0].geometry.coordinates).toEqual([
      [
        [-180, -90],
        [180, 90],
      ],
    ]);
  });
});

describe("centerline fetch failures", () => {
  it("forwards the optional signal and rejects an HTTP failure", async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ ok: false, status: 503, json: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchEligibleCenterlines(BOUNDS, { signal: controller.signal }),
    ).rejects.toThrow("NYC Street Centerline request failed (503)");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("rejects a successful response whose JSON body is not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ json: { rows: [] } })),
    );

    await expect(fetchEligibleCenterlines(BOUNDS)).rejects.toThrow(
      /invalid response/i,
    );
  });

  it("normalizes a successful array response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ json: [centerlineRow()] })),
    );

    await expect(fetchEligibleCenterlines(BOUNDS)).resolves.toHaveLength(1);
  });
});

describe("intersection grouping and GeoJSON adapters", () => {
  it("deduplicates repeated street names and physical IDs at the same endpoint", () => {
    const centerlines = [
      normalizedCenterline(),
      normalizedCenterline(),
      normalizedCenterline({ physicalId: "101" }),
      normalizedCenterline({
        physicalId: "200",
        streetName: "5 AVE",
        geometry: {
          type: "MultiLineString",
          coordinates: [[NODE, [-73.9816, 40.7525]]],
        },
      }),
    ];

    expect(groupIntersectionCandidates(centerlines)).toEqual([
      expect.objectContaining({
        displayName: "W 40 ST at 5 AVE",
        streetNames: ["W 40 ST", "5 AVE"],
        physicalIds: ["100", "101", "200"],
      }),
    ]);
  });

  it("defensively ignores empty or incomplete normalized geometries", () => {
    const malformed = [
      normalizedCenterline({
        geometry: {
          type: "MultiLineString",
          coordinates: [],
        },
      }),
      normalizedCenterline({
        geometry: {
          type: "MultiLineString",
          coordinates: [[]],
        },
      }),
    ];

    expect(groupIntersectionCandidates(malformed)).toEqual([]);
  });

  it("emits stable centerline and candidate feature collections", () => {
    const centerlines = [
      normalizedCenterline(),
      normalizedCenterline({
        physicalId: "200",
        streetName: "5 AVE",
        geometry: {
          type: "MultiLineString",
          coordinates: [[NODE, [-73.9816, 40.7525]]],
        },
      }),
    ];
    const candidates = groupIntersectionCandidates(centerlines);

    expect(centerlinesFeatureCollection(centerlines)).toMatchObject({
      type: "FeatureCollection",
      features: [
        {
          geometry: centerlines[0].geometry,
          properties: { physicalId: "100", streetName: "W 40 ST" },
        },
        {
          geometry: centerlines[1].geometry,
          properties: { physicalId: "200", streetName: "5 AVE" },
        },
      ],
    });
    expect(candidatesFeatureCollection(candidates)).toMatchObject({
      type: "FeatureCollection",
      features: [
        {
          geometry: { type: "Point", coordinates: NODE },
          properties: {
            candidateIndex: 0,
            displayName: "W 40 ST at 5 AVE",
            level: "13",
            streetNames: ["W 40 ST", "5 AVE"],
            physicalIds: ["100", "200"],
          },
        },
      ],
    });
  });
});
