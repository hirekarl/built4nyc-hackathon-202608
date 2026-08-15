import type { Feature, Polygon } from "geojson";

const EARTH_RADIUS_METERS = 6_371_008.8;
const CIRCLE_SEGMENTS = 64;

export interface GeographicCoordinate {
  latitude: number;
  longitude: number;
}

export interface CircleFeature extends Feature<Polygon, { radiusMeters: 50 }> {
  geometry: {
    type: "Polygon";
    coordinates: [[number, number][]];
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function createCircleFeature(
  center: GeographicCoordinate,
  radiusMeters: 50,
): CircleFeature {
  if (
    !Number.isFinite(center.latitude) ||
    !Number.isFinite(center.longitude) ||
    center.latitude < -90 ||
    center.latitude > 90 ||
    center.longitude < -180 ||
    center.longitude > 180
  ) {
    throw new Error("Invalid circle center coordinate.");
  }

  const latitude = toRadians(center.latitude);
  const longitude = toRadians(center.longitude);
  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const ring: [number, number][] = [];

  for (let index = 0; index < CIRCLE_SEGMENTS; index += 1) {
    const bearing = (index / CIRCLE_SEGMENTS) * Math.PI * 2;
    const pointLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) -
          Math.sin(latitude) * Math.sin(pointLatitude),
      );
    ring.push([toDegrees(pointLongitude), toDegrees(pointLatitude)]);
  }
  ring.push([...ring[0]]);

  return {
    type: "Feature",
    properties: { radiusMeters },
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}
