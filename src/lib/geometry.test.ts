import type { Polygon, MultiPolygon } from "geojson";
import { describe, expect, it } from "vitest";
import { circleIntersectsPolygon, createCircleFeature } from "./geometry";

describe("createCircleFeature", () => {
  it("creates a closed 64-segment polygon for the fixed radius", () => {
    const feature = createCircleFeature(
      { latitude: 40.752205375223, longitude: -73.981823738617 },
      50,
    );
    const ring = feature.geometry.coordinates[0];

    expect(feature).toMatchObject({
      type: "Feature",
      properties: { radiusMeters: 50 },
      geometry: { type: "Polygon" },
    });
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring.at(-1));
  });

  it.each([
    { latitude: Number.NaN, longitude: -73.9 },
    { latitude: Number.POSITIVE_INFINITY, longitude: -73.9 },
    { latitude: 40.7, longitude: Number.NEGATIVE_INFINITY },
    { latitude: -90.0001, longitude: -73.9 },
    { latitude: 90.0001, longitude: -73.9 },
    { latitude: 40.7, longitude: -180.0001 },
    { latitude: 40.7, longitude: 180.0001 },
  ])("rejects the invalid coordinate $latitude,$longitude", (center) => {
    expect(() => createCircleFeature(center, 50)).toThrow(
      "Invalid circle center coordinate.",
    );
  });

  it.each([
    { latitude: -90, longitude: -180 },
    { latitude: 90, longitude: 180 },
  ])("accepts coordinate range boundaries", (center) => {
    expect(
      createCircleFeature(center, 50).geometry.coordinates[0],
    ).toHaveLength(65);
  });
});

// Center used for all circleIntersectsPolygon fixtures below — a real
// Manhattan coordinate (near Grand Central), matching the fixture used for
// createCircleFeature above so the two suites stay consistent.
const CENTER = { latitude: 40.752205375223, longitude: -73.981823738617 };

// A large square (~2 degrees on a side, in correct [longitude, latitude]
// GeoJSON order) that fully contains the 50m circle around CENTER.
const CONTAINING_POLYGON: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [CENTER.longitude - 1, CENTER.latitude - 1],
      [CENTER.longitude + 1, CENTER.latitude - 1],
      [CENTER.longitude + 1, CENTER.latitude + 1],
      [CENTER.longitude - 1, CENTER.latitude + 1],
      [CENTER.longitude - 1, CENTER.latitude - 1],
    ],
  ],
};

// A small square nowhere near CENTER — roughly 1 degree (~111km) away,
// far outside the 50m circle.
const DISJOINT_POLYGON: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [CENTER.longitude + 5, CENTER.latitude + 5],
      [CENTER.longitude + 5.001, CENTER.latitude + 5],
      [CENTER.longitude + 5.001, CENTER.latitude + 5.001],
      [CENTER.longitude + 5, CENTER.latitude + 5.001],
      [CENTER.longitude + 5, CENTER.latitude + 5],
    ],
  ],
};

// A half-plane polygon whose western edge runs exactly along CENTER's
// longitude, extending east to +1 degree — this splits the 50m circle
// roughly in half: the eastern half overlaps the polygon, the western
// half does not. This is the SPEC's named boundary-straddle case.
const STRADDLING_POLYGON: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [CENTER.longitude, CENTER.latitude - 1],
      [CENTER.longitude + 1, CENTER.latitude - 1],
      [CENTER.longitude + 1, CENTER.latitude + 1],
      [CENTER.longitude, CENTER.latitude + 1],
      [CENTER.longitude, CENTER.latitude - 1],
    ],
  ],
};

describe("circleIntersectsPolygon", () => {
  it("returns true when the circle is fully inside the polygon", () => {
    const circle = createCircleFeature(CENTER, 50);
    expect(circleIntersectsPolygon(circle, CONTAINING_POLYGON)).toBe(true);
  });

  it("returns false when the circle is fully outside the polygon", () => {
    const circle = createCircleFeature(CENTER, 50);
    expect(circleIntersectsPolygon(circle, DISJOINT_POLYGON)).toBe(false);
  });

  it("returns true for a boundary straddle — partial overlap counts as intersecting, not just full containment", () => {
    const circle = createCircleFeature(CENTER, 50);
    expect(circleIntersectsPolygon(circle, STRADDLING_POLYGON)).toBe(true);
  });

  it("returns true when a polygon touches the circle only at a shared vertex (decision: a single shared point counts as an intersection, matching turf/GEOS 'intersects' semantics — only fully disjoint geometries return false)", () => {
    const circle = createCircleFeature(CENTER, 50);
    const touchPoint = circle.geometry.coordinates[0][0];
    // A triangle with one vertex pinned exactly to a point on the circle's
    // boundary ring, with the other two vertices extending far outward
    // (away from CENTER) so the triangle otherwise shares no area with the
    // circle's interior.
    const vertexTouchingPolygon: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          touchPoint,
          [touchPoint[0] + 1, touchPoint[1] + 1],
          [touchPoint[0] - 1, touchPoint[1] + 1],
          touchPoint,
        ],
      ],
    };
    expect(circleIntersectsPolygon(circle, vertexTouchingPolygon)).toBe(true);
  });

  it("works against a MultiPolygon, matching qzji-nvbd's the_geom type", () => {
    const circle = createCircleFeature(CENTER, 50);
    const multi: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        DISJOINT_POLYGON.coordinates,
        CONTAINING_POLYGON.coordinates,
      ],
    };
    expect(circleIntersectsPolygon(circle, multi)).toBe(true);
  });

  it("returns false for a MultiPolygon whose parts are all disjoint from the circle", () => {
    const circle = createCircleFeature(CENTER, 50);
    const farAwayPolygon: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [CENTER.longitude - 10, CENTER.latitude - 10],
          [CENTER.longitude - 9.999, CENTER.latitude - 10],
          [CENTER.longitude - 9.999, CENTER.latitude - 9.999],
          [CENTER.longitude - 10, CENTER.latitude - 9.999],
          [CENTER.longitude - 10, CENTER.latitude - 10],
        ],
      ],
    };
    const multi: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [DISJOINT_POLYGON.coordinates, farAwayPolygon.coordinates],
    };
    expect(circleIntersectsPolygon(circle, multi)).toBe(false);
  });

  it("PRD §13 regression: reversing a polygon's coordinate order from [lon, lat] to [lat, lon] must change the answer, proving the function is order-sensitive", () => {
    const circle = createCircleFeature(CENTER, 50);

    // Same containing polygon, but every [longitude, latitude] pair has been
    // swapped to [latitude, longitude] — a common, easy-to-introduce bug
    // when consuming Socrata's the_geom (which is correctly [lon, lat]).
    const reversedOrderPolygon: Polygon = {
      type: "Polygon",
      coordinates: [
        CONTAINING_POLYGON.coordinates[0].map(
          ([longitude, latitude]) => [latitude, longitude] as [number, number],
        ),
      ],
    };

    expect(circleIntersectsPolygon(circle, CONTAINING_POLYGON)).toBe(true);
    expect(circleIntersectsPolygon(circle, reversedOrderPolygon)).toBe(false);
  });
});
