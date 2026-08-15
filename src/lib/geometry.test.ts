import { describe, expect, it } from "vitest";
import { createCircleFeature } from "./geometry";

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
