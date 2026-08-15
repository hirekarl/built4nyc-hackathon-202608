import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCenterlineUrl,
  fetchEligibleCenterlines,
  groupIntersectionCandidates,
  normalizeCenterlineRows,
} from "../lib/centerline-client";
import { createCircleFeature } from "../lib/geometry";
import Map from "./Map";

type MapHandler = (event?: Record<string, unknown>) => void;

const maplibreHarness = vi.hoisted(() => {
  class MockGeoJsonSource {
    data: unknown;

    constructor(data: unknown) {
      this.data = data;
    }

    setData(data: unknown) {
      this.data = data;
    }
  }

  class MockAttributionControl {
    options: unknown;

    constructor(options?: unknown) {
      this.options = options;
    }
  }

  class MockNavigationControl {}

  class MockMap {
    options: Record<string, unknown>;
    handlers: Array<{
      event: string;
      layer?: string;
      handler: MapHandler;
    }> = [];
    layers: Array<Record<string, unknown>> = [];
    sources = new globalThis.Map<string, MockGeoJsonSource>();
    filters = new globalThis.Map<string, unknown>();
    controls: unknown[] = [];
    canvas = { style: { cursor: "" } };
    removed = false;
    bounds = {
      north: 40.76,
      west: -73.99,
      south: 40.74,
      east: -73.97,
    };

    constructor(options: Record<string, unknown>) {
      this.options = options;
      instances.push(this);
    }

    on(
      event: string,
      layerOrHandler: string | MapHandler,
      handler?: MapHandler,
    ) {
      if (typeof layerOrHandler === "string" && handler) {
        this.handlers.push({ event, layer: layerOrHandler, handler });
      } else if (typeof layerOrHandler === "function") {
        this.handlers.push({ event, handler: layerOrHandler });
      }
      return this;
    }

    off() {
      return this;
    }

    addControl(control: unknown) {
      this.controls.push(control);
      return this;
    }

    addSource(id: string, definition: { data?: unknown }) {
      this.sources.set(id, new MockGeoJsonSource(definition.data));
    }

    getSource(id: string) {
      return this.sources.get(id);
    }

    addLayer(layer: Record<string, unknown>) {
      this.layers.push(layer);
    }

    getLayer(id: string) {
      return this.layers.find((layer) => layer.id === id);
    }

    setFilter(id: string, filter: unknown) {
      this.filters.set(id, filter);
    }

    getCanvas() {
      return this.canvas;
    }

    getBounds() {
      return {
        getNorth: () => this.bounds.north,
        getWest: () => this.bounds.west,
        getSouth: () => this.bounds.south,
        getEast: () => this.bounds.east,
      };
    }

    getCenter() {
      const [lng, lat] = this.options.center as [number, number];
      return { lng, lat };
    }

    remove() {
      this.removed = true;
    }

    trigger(event: string, payload: Record<string, unknown> = {}) {
      this.handlers
        .filter((entry) => entry.event === event && entry.layer === undefined)
        .forEach((entry) => entry.handler(payload));
    }

    triggerLayer(
      event: string,
      layer: string,
      payload: Record<string, unknown> = {},
    ) {
      this.handlers
        .filter((entry) => entry.event === event && entry.layer === layer)
        .forEach((entry) => entry.handler(payload));
    }
  }

  const instances: MockMap[] = [];

  return {
    MockAttributionControl,
    MockMap,
    MockNavigationControl,
    instances,
  };
});

vi.mock("maplibre-gl", () => ({
  default: {
    AttributionControl: maplibreHarness.MockAttributionControl,
    Map: maplibreHarness.MockMap,
    NavigationControl: maplibreHarness.MockNavigationControl,
  },
  AttributionControl: maplibreHarness.MockAttributionControl,
  Map: maplibreHarness.MockMap,
  NavigationControl: maplibreHarness.MockNavigationControl,
}));

const W40_NODE = [-73.981823738617, 40.752205375223] as const;
const E42_NODE = [-73.977792815236, 40.752175843845] as const;
const VIADUCT_NODE = [-73.977677899268, 40.752127185796] as const;

const sourceRows = [
  {
    physicalid: "183093",
    rw_type: "1",
    from_level_code: "13",
    to_level_code: "13",
    full_street_name: "W  40 ST",
    street_name: "40",
    stname_label: "W 40 ST",
    b5sc: "134570",
    globalid: "22a224c4-07ad-4337-8b2a-d83f5dabe22a",
    the_geom: {
      type: "MultiLineString",
      coordinates: [
        [
          [-73.981823738617, 40.752205375223],
          [-73.983459959877, 40.752894698732],
          [-73.983607423413, 40.75295682189],
          [-73.985044934377, 40.753562396668],
        ],
      ],
    },
  },
  {
    physicalid: "1941",
    rw_type: "1",
    from_level_code: "13",
    to_level_code: "13",
    full_street_name: "5 AVE",
    street_name: "5",
    stname_label: "5 AVE",
    b5sc: "110410",
    globalid: "b030986f-7c3a-4cd1-875b-9b7fddca1f58",
    the_geom: {
      type: "MultiLineString",
      coordinates: [
        [
          [-73.981823738617, 40.752205375223],
          [-73.98137279908, 40.75282210105],
        ],
      ],
    },
  },
  {
    physicalid: "73419",
    rw_type: "1",
    from_level_code: "13",
    to_level_code: "13",
    full_street_name: "E  42 ST",
    street_name: "42",
    stname_label: "E 42 ST",
    b5sc: "117830",
    globalid: "b38cf4ab-bc13-4299-92f5-2905e0252962",
    the_geom: {
      type: "MultiLineString",
      coordinates: [
        [
          [-73.977792815236, 40.752175843845],
          [-73.977677899268, 40.752127185796],
        ],
      ],
    },
  },
  {
    physicalid: "148625",
    rw_type: "1",
    from_level_code: "13",
    to_level_code: "13",
    full_street_name: "PARK AVE",
    street_name: "PARK",
    stname_label: "PARK AVE",
    b5sc: "127790",
    globalid: "dd16fd94-8c2f-4b65-bb0e-80b8a00bb1ac",
    the_geom: {
      type: "MultiLineString",
      coordinates: [
        [
          [-73.978277926301, 40.751512843753],
          [-73.978193082191, 40.751630795418],
          [-73.977792815236, 40.752175843845],
        ],
      ],
    },
  },
  {
    physicalid: "2469",
    rw_type: "1",
    from_level_code: "17",
    to_level_code: "17",
    full_street_name: "PARK AVE  VIADUCT",
    street_name: "PARK",
    stname_label: "PARK AVE VIADUCT",
    b5sc: "127790",
    globalid: "9402a5a3-5be6-4f49-8ef4-c44cfe162751",
    the_geom: {
      type: "MultiLineString",
      coordinates: [
        [
          [-73.977677899268, 40.752127185796],
          [-73.977526762883, 40.752311291204],
        ],
      ],
    },
  },
];

function paginatedSourceRows(count = 13) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const longitude = -73.9802 + number * 0.0001;
    const latitude = 40.7525;
    const node = [longitude, latitude];
    return [
      {
        physicalid: `test-street-${number}`,
        rw_type: "1",
        from_level_code: "13",
        to_level_code: "13",
        stname_label: `TEST ${number} ST`,
        the_geom: {
          type: "MultiLineString",
          coordinates: [[node, [longitude, latitude + 0.00004]]],
        },
      },
      {
        physicalid: `test-cross-${number}`,
        rw_type: "1",
        from_level_code: "13",
        to_level_code: "13",
        stname_label: "CROSS AVE",
        the_geom: {
          type: "MultiLineString",
          coordinates: [[node, [longitude + 0.00004, latitude]]],
        },
      },
    ];
  }).flat();
}

function jsonResponse(rows: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(rows),
  } as unknown as Response;
}

function latestMap() {
  const map = maplibreHarness.instances.at(-1);
  if (!map) throw new Error("Expected MapLibre map to be initialized");
  return map;
}

function pointFeatureFromMap(
  map: InstanceType<typeof maplibreHarness.MockMap>,
) {
  for (const source of map.sources.values()) {
    const collection = source.data as {
      features?: Array<{
        geometry?: { type?: string };
        properties?: Record<string, unknown>;
      }>;
    };
    const point = collection?.features?.find(
      (feature) => feature.geometry?.type === "Point",
    );
    if (point) return point;
  }
  throw new Error("Expected an intersection Point feature");
}

function distanceMeters(
  center: { latitude: number; longitude: number },
  point: [number, number],
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(point[1] - center.latitude);
  const longitudeDelta = radians(point[0] - center.longitude);
  const latitude1 = radians(center.latitude);
  const latitude2 = radians(point[1]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    6_371_008.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

beforeEach(() => {
  maplibreHarness.instances.length = 0;
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NYC Street Centerline client", () => {
  it("builds a viewport-scoped URL with only the documented fields and filters", () => {
    const url = new URL(
      buildCenterlineUrl({
        north: 40.76,
        west: -73.99,
        south: 40.74,
        east: -73.97,
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://data.cityofnewyork.us/resource/inkn-q76z.json",
    );
    expect(url.searchParams.get("$select")?.split(",")).toEqual([
      "the_geom",
      "physicalid",
      "rw_type",
      "nonped",
      "from_level_code",
      "to_level_code",
      "full_street_name",
      "street_name",
      "stname_label",
      "b5sc",
      "bphys_id",
      "globalid",
    ]);
    expect(url.searchParams.get("$where")).toBe(
      "within_box(the_geom, 40.76, -73.99, 40.74, -73.97) AND rw_type='1' AND (nonped IS NULL OR nonped='')",
    );
  });

  it.each([
    { north: 40.74, west: -73.99, south: 40.74, east: -73.97 },
    { north: 40.76, west: -73.97, south: 40.74, east: -73.99 },
    { north: 91, west: -73.99, south: 40.74, east: -73.97 },
    { north: 40.76, west: Number.NaN, south: 40.74, east: -73.97 },
  ])(
    "rejects invalid or inverted bounds: $north,$west,$south,$east",
    (bounds) => {
      expect(() => buildCenterlineUrl(bounds)).toThrow(/bounds/i);
    },
  );

  it("forwards an AbortSignal and normalizes MultiLineString rows", async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sourceRows));

    const result = await fetchEligibleCenterlines(
      { north: 40.76, west: -73.99, south: 40.74, east: -73.97 },
      { signal: controller.signal },
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("inkn-q76z.json"),
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(result).toHaveLength(sourceRows.length);
    expect(result[0]).toMatchObject({
      physicalId: "183093",
      streetName: "W 40 ST",
      fromLevel: "13",
      toLevel: "13",
      geometry: { type: "MultiLineString" },
    });
  });

  it("groups exact endpoints by coordinate and level without merging levels 13 and 17", () => {
    const candidates = groupIntersectionCandidates(
      normalizeCenterlineRows(sourceRows),
    );

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "W 40 ST at 5 AVE",
          coordinate: {
            longitude: W40_NODE[0],
            latitude: W40_NODE[1],
          },
          level: "13",
          streetNames: ["W 40 ST", "5 AVE"],
          physicalIds: ["183093", "1941"],
        }),
        expect.objectContaining({
          displayName: "E 42 ST at PARK AVE",
          coordinate: {
            longitude: E42_NODE[0],
            latitude: E42_NODE[1],
          },
          level: "13",
          streetNames: ["E 42 ST", "PARK AVE"],
          physicalIds: ["73419", "148625"],
        }),
      ]),
    );
    expect(
      candidates.some(
        ({ streetNames }) =>
          streetNames.includes("PARK AVE") &&
          streetNames.includes("PARK AVE VIADUCT"),
      ),
    ).toBe(false);
    expect(
      candidates.some(
        ({ coordinate }) =>
          coordinate.longitude === VIADUCT_NODE[0] &&
          coordinate.latitude === VIADUCT_NODE[1],
      ),
    ).toBe(false);
    expect(candidates.every(({ streetNames }) => streetNames.length >= 2)).toBe(
      true,
    );
  });

  it("groups blank endpoint levels only with other blank endpoint levels", () => {
    const blankLevelRows = sourceRows.slice(0, 2).map((row) => ({
      ...row,
      from_level_code: "",
      to_level_code: "",
    }));

    const normalized = normalizeCenterlineRows(blankLevelRows);
    const candidates = groupIntersectionCandidates(normalized);

    expect(normalized).toHaveLength(2);
    expect(candidates).toEqual([
      expect.objectContaining({
        coordinate: {
          longitude: W40_NODE[0],
          latitude: W40_NODE[1],
        },
        level: "",
        streetNames: ["W 40 ST", "5 AVE"],
        physicalIds: ["183093", "1941"],
      }),
    ]);
  });
});

describe("fixed analysis-circle geometry", () => {
  it("creates a closed GeoJSON polygon with a 50-meter radius", () => {
    const center = { latitude: W40_NODE[1], longitude: W40_NODE[0] };
    const circle = createCircleFeature(center, 50);
    const ring = circle.geometry.coordinates[0];

    expect(circle).toMatchObject({
      type: "Feature",
      properties: { radiusMeters: 50 },
      geometry: { type: "Polygon" },
    });
    expect(ring[0]).toEqual(ring.at(-1));
    expect(distanceMeters(center, ring[0])).toBeCloseTo(50, 0);
  });
});

describe("map selection foundation", () => {
  it("uses OpenFreeMap Bright, keeps attribution, and creates distinct line, hit, and marker layers", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sourceRows));
    render(<Map onSelect={vi.fn()} />);
    const map = latestMap();

    expect(map.options.style).toMatch(/openfreemap.*bright/i);
    expect(map.options.attributionControl).not.toBe(false);

    await act(async () => map.trigger("load"));
    await waitFor(() => expect(map.layers.length).toBeGreaterThanOrEqual(3));

    expect(map.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "line" }),
        expect.objectContaining({
          type: "circle",
          paint: expect.objectContaining({ "circle-radius": 34 }),
        }),
        expect.objectContaining({
          type: "circle",
          paint: expect.objectContaining({ "circle-radius": 6 }),
        }),
      ]),
    );
  });

  it("shows official names on hover, emits the clicked selection, and adds the 50-meter boundary", async () => {
    const onSelect = vi.fn();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sourceRows));
    render(<Map onSelect={onSelect} />);
    const map = latestMap();

    await act(async () => map.trigger("load"));
    await waitFor(() => expect(map.layers.length).toBeGreaterThanOrEqual(3));

    const hitLayer = map.layers.find(
      (layer) =>
        layer.type === "circle" &&
        (layer.paint as Record<string, unknown>)?.["circle-radius"] === 34,
    );
    expect(hitLayer).toBeDefined();
    const pointFeature = pointFeatureFromMap(map);

    act(() => {
      map.triggerLayer("mouseenter", String(hitLayer?.id), {
        features: [pointFeature],
      });
    });
    expect(screen.getByText(/W 40 ST at 5 AVE/i)).toBeInTheDocument();

    act(() => {
      map.triggerLayer("click", String(hitLayer?.id), {
        features: [pointFeature],
      });
    });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "intersection",
        displayName: "W 40 ST at 5 AVE",
      }),
    );
    await waitFor(() => {
      const hasBoundary = [...map.sources.values()].some((source) => {
        const feature = source.data as {
          properties?: { radiusMeters?: number };
        };
        return feature?.properties?.radiusMeters === 50;
      });
      expect(hasBoundary).toBe(true);
    });
  });

  it("highlights the selected intersection's contributing centerlines", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sourceRows));
    render(<Map onSelect={vi.fn()} />);
    const map = latestMap();

    await act(async () => map.trigger("load"));
    await waitFor(() => expect(map.layers.length).toBeGreaterThanOrEqual(4));

    const hitLayer = map.layers.find(
      (layer) =>
        layer.type === "circle" &&
        (layer.paint as Record<string, unknown>)?.["circle-radius"] === 34,
    );
    const pointFeature = pointFeatureFromMap(map);
    act(() => {
      map.triggerLayer("click", String(hitLayer?.id), {
        features: [pointFeature],
      });
    });

    const selectedLineLayer = map.layers.find(
      (layer) => layer.type === "line" && /selected/i.test(String(layer.id)),
    );
    expect(selectedLineLayer).toBeDefined();
    expect(
      JSON.stringify(map.filters.get(String(selectedLineLayer?.id))),
    ).toContain("183093");
    expect(
      JSON.stringify(map.filters.get(String(selectedLineLayer?.id))),
    ).toContain("1941");
  });

  it("aborts the prior viewport request and ignores its late response", async () => {
    const requests: Array<{
      signal?: AbortSignal;
      resolve: (response: Response) => void;
    }> = [];
    vi.mocked(fetch).mockImplementation((_url, init) => {
      return new Promise<Response>((resolve) => {
        requests.push({ signal: init?.signal as AbortSignal, resolve });
      });
    });
    render(<Map onSelect={vi.fn()} />);
    const map = latestMap();

    act(() => map.trigger("load"));
    await waitFor(() => expect(requests).toHaveLength(1));

    map.bounds = { north: 40.77, west: -73.98, south: 40.75, east: -73.96 };
    act(() => map.trigger("moveend"));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0].signal?.aborted).toBe(true);

    await act(async () => {
      requests[1].resolve(jsonResponse(sourceRows.slice(2, 5)));
    });
    await waitFor(() => {
      const point = pointFeatureFromMap(map);
      expect(point.properties?.displayName).toBe("E 42 ST at PARK AVE");
    });

    await act(async () => {
      requests[0].resolve(jsonResponse(sourceRows.slice(0, 2)));
    });
    await waitFor(() => {
      const point = pointFeatureFromMap(map);
      expect(point.properties?.displayName).toBe("E 42 ST at PARK AVE");
    });
  });

  it("renders deterministic loading, retryable error, and empty states", async () => {
    let rejectFirst: ((reason: Error) => void) | undefined;
    vi.mocked(fetch)
      .mockImplementationOnce(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(jsonResponse([]));

    render(<Map onSelect={vi.fn()} />);
    const map = latestMap();
    act(() => map.trigger("load"));
    expect(screen.getByRole("status")).toHaveTextContent(/loading street/i);

    await act(async () => rejectFirst?.(new Error("source unavailable")));
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(screen.getByRole("alert")).toHaveTextContent(/street data/i);

    fireEvent.click(retry);
    expect(
      await screen.findByText("No eligible intersections in this map view."),
    ).toBeVisible();
  });
});

describe("keyboard-accessible intersection proxy", () => {
  it("is compact by default and exposes the first 12 nearest candidates on demand", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(paginatedSourceRows()));
    render(<Map onSelect={vi.fn()} />);
    const map = latestMap();
    await act(async () => map.trigger("load"));

    const toggle = screen.getByRole("button", {
      name: "Choose an intersection without using the map",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const listId = toggle.getAttribute("aria-controls");
    expect(listId).toBeTruthy();
    const controlledList = document.getElementById(String(listId));
    if (controlledList) expect(controlledList).not.toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "13 eligible intersections in this map view.",
      ),
    );

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", {
      name: /intersections in this map view/i,
    });
    const firstPage = within(list).getAllByRole("button");
    expect(firstPage).toHaveLength(12);
    expect(firstPage[0]).toHaveAccessibleName(
      /TEST 1 ST at CROSS AVE.*40\.7525.*-73\.9801/i,
    );
    expect(firstPage[11]).toHaveAccessibleName(/TEST 12 ST at CROSS AVE/i);

    fireEvent.click(
      screen.getByRole("button", { name: "Show more intersections" }),
    );
    expect(within(list).getAllByRole("button")).toHaveLength(13);
    expect(
      screen.queryByRole("button", { name: "Show more intersections" }),
    ).not.toBeInTheDocument();
  });

  it("sorts equal-distance candidates by official name and distinguishes duplicate names by coordinate", async () => {
    const center = [-73.9802, 40.7525] as const;
    const rows = [
      ...paginatedSourceRows(1),
      ...[
        ["ZED ST", -0.0002, "zed"],
        ["ALPHA ST", 0.0002, "alpha"],
        ["ALPHA ST", -0.0003, "alpha-duplicate"],
      ].flatMap(([name, offset, id]) => {
        const longitude = center[0] + Number(offset);
        const node = [longitude, center[1]];
        return [
          {
            physicalid: `${id}-street`,
            rw_type: "1",
            from_level_code: "13",
            to_level_code: "13",
            stname_label: String(name),
            the_geom: {
              type: "MultiLineString",
              coordinates: [[node, [longitude, center[1] + 0.00004]]],
            },
          },
          {
            physicalid: `${id}-cross`,
            rw_type: "1",
            from_level_code: "13",
            to_level_code: "13",
            stname_label: "TIE AVE",
            the_geom: {
              type: "MultiLineString",
              coordinates: [[node, [longitude + 0.00004, center[1]]]],
            },
          },
        ];
      }),
    ];
    vi.mocked(fetch).mockResolvedValue(jsonResponse(rows));
    render(<Map onSelect={vi.fn()} />);
    const map = latestMap();
    await act(async () => map.trigger("load"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose an intersection without using the map",
      }),
    );

    const list = screen.getByRole("list", {
      name: /intersections in this map view/i,
    });
    const names = within(list)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(names[1]).toMatch(/ALPHA ST at TIE AVE/i);
    expect(names[2]).toMatch(/ZED ST at TIE AVE/i);
    expect(
      names.filter((name) => /ALPHA ST at TIE AVE/i.test(name ?? "")),
    ).toHaveLength(2);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses the same selection path for proxy and pointer activation", async () => {
    const onSelect = vi.fn();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sourceRows));
    render(<Map onSelect={onSelect} />);
    const map = latestMap();
    await act(async () => map.trigger("load"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose an intersection without using the map",
      }),
    );

    const proxy = screen.getByRole("button", {
      name: /W 40 ST at 5 AVE.*40\.752205.*-73\.981824/i,
    });
    expect(proxy).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(proxy);
    expect(proxy).toHaveAttribute("aria-pressed", "true");
    const proxySelection = onSelect.mock.calls[0][0];

    const hitLayer = map.layers.find(
      (layer) =>
        layer.type === "circle" &&
        (layer.paint as Record<string, unknown>)?.["circle-radius"] === 34,
    );
    act(() => {
      map.triggerLayer("click", String(hitLayer?.id), {
        features: [pointFeatureFromMap(map)],
      });
    });
    expect(onSelect.mock.calls[1][0]).toEqual(proxySelection);
    expect(
      JSON.stringify(map.filters.get("selected-centerline-lines")),
    ).toContain("183093");
    expect(
      [...map.sources.values()].some(
        (source) =>
          (source.data as { properties?: { radiusMeters?: number } })
            ?.properties?.radiusMeters === 50,
      ),
    ).toBe(true);
  });

  it("resets pagination on viewport change while preserving a locked off-view selection", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(paginatedSourceRows()))
      .mockResolvedValueOnce(jsonResponse([]));
    const onSelect = vi.fn();
    render(<Map onSelect={onSelect} />);
    const map = latestMap();
    await act(async () => map.trigger("load"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose an intersection without using the map",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show more intersections" }),
    );
    const selected = screen.getByRole("button", {
      name: /TEST 1 ST at CROSS AVE/i,
    });
    fireEvent.click(selected);

    act(() => map.trigger("moveend"));
    expect(
      await screen.findByText("No eligible intersections in this map view."),
    ).toBeVisible();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(
      JSON.stringify(map.filters.get("selected-centerline-lines")),
    ).toContain("test-street-1");
    expect(
      [...map.sources.values()].some(
        (source) =>
          (source.data as { properties?: { radiusMeters?: number } })
            ?.properties?.radiusMeters === 50,
      ),
    ).toBe(true);
  });

  it("removes a stale proxy list on failure and exposes retry", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(sourceRows))
      .mockRejectedValueOnce(new Error("source unavailable"));
    render(<Map onSelect={vi.fn()} />);
    const map = latestMap();
    await act(async () => map.trigger("load"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose an intersection without using the map",
      }),
    );
    expect(
      screen.getByRole("button", { name: /W 40 ST at 5 AVE/i }),
    ).toBeInTheDocument();

    act(() => map.trigger("moveend"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/street data/i);
    expect(
      screen.queryByRole("button", { name: /W 40 ST at 5 AVE/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeEnabled();
  });
});

describe("map defensive DOM behavior", () => {
  it.each([
    new DOMException("Request aborted", "AbortError"),
    Object.assign(new Error("Request aborted"), { name: "AbortError" }),
  ])(
    "silently handles an AbortError without showing retry UI",
    async (error) => {
      vi.mocked(fetch).mockRejectedValue(error);
      render(<Map onSelect={vi.fn()} />);
      const map = latestMap();

      await act(async () => map.trigger("load"));

      await waitFor(() =>
        expect(
          screen.queryByText(/loading street data/i),
        ).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("clears hover state on mouseleave and accepts numeric-string candidate indexes", async () => {
    const onSelect = vi.fn();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sourceRows));
    render(<Map onSelect={onSelect} />);
    const map = latestMap();
    await act(async () => map.trigger("load"));

    const hitLayer = map.layers.find(
      (layer) =>
        layer.type === "circle" &&
        (layer.paint as Record<string, unknown>)?.["circle-radius"] === 34,
    );
    const pointFeature = pointFeatureFromMap(map);
    const stringIndexFeature = {
      ...pointFeature,
      properties: { ...pointFeature.properties, candidateIndex: "0" },
    };

    act(() => {
      map.triggerLayer("mouseenter", String(hitLayer?.id), {
        features: [stringIndexFeature],
      });
    });
    expect(map.canvas.style.cursor).toBe("pointer");
    expect(screen.getByText("W 40 ST at 5 AVE")).toBeInTheDocument();

    act(() => map.triggerLayer("mouseleave", String(hitLayer?.id)));
    expect(map.canvas.style.cursor).toBe("");
    expect(screen.queryByText("W 40 ST at 5 AVE")).not.toBeInTheDocument();

    act(() => {
      map.triggerLayer("click", String(hitLayer?.id), {
        features: [stringIndexFeature],
      });
    });
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("ignores malformed, non-integer, missing, and unmatched candidate indexes", async () => {
    const onSelect = vi.fn();
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sourceRows));
    render(<Map onSelect={onSelect} />);
    const map = latestMap();
    await act(async () => map.trigger("load"));

    const hitLayer = map.layers.find(
      (layer) =>
        layer.type === "circle" &&
        (layer.paint as Record<string, unknown>)?.["circle-radius"] === 34,
    );
    const invalidFeatures = [
      { properties: { candidateIndex: "not-a-number" } },
      { properties: { candidateIndex: 0.5 } },
      { properties: { candidateIndex: "99" } },
      { properties: { candidateIndex: true } },
    ];

    for (const feature of invalidFeatures) {
      act(() => {
        map.triggerLayer("mouseenter", String(hitLayer?.id), {
          features: [feature],
        });
        map.triggerLayer("click", String(hitLayer?.id), {
          features: [feature],
        });
      });
    }
    act(() => {
      map.triggerLayer("mouseenter", String(hitLayer?.id));
      map.triggerLayer("click", String(hitLayer?.id));
    });

    expect(map.canvas.style.cursor).toBe("");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("announces singular grammar for one eligible intersection", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(sourceRows.slice(0, 2)));
    render(<Map onSelect={vi.fn()} />);
    const map = latestMap();

    await act(async () => map.trigger("load"));

    expect(screen.getByRole("status")).toHaveTextContent(
      "1 eligible intersection in this map view.",
    );
  });

  it("aborts an in-flight viewport request and removes the map on unmount", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_url, init) => {
      signal = init?.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    });
    const { unmount } = render(<Map onSelect={vi.fn()} />);
    const map = latestMap();
    act(() => map.trigger("load"));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    unmount();

    expect(signal?.aborted).toBe(true);
    expect(map.removed).toBe(true);
  });
});
