---
type: reference
status: adopted for MVP spatial relationships
source: verified against official dataset metadata and live queries, 2026-08-15
---

# Dataset joins and spatial relationships

EZStreet does not use a database join for its MVP. It connects official centerlines, collision points, and Priority Zone multipolygons through one locked intersection selection and tested spatial operations.

## Centerline records to intersection selection

1. Load eligible centerline features for the current map viewport.
2. Normalize official names, endpoint coordinates, and physical IDs.
3. Group exact shared endpoint coordinates to form ordinary intersection candidates.
4. Expose candidates with at least two eligible named streets.
5. Preserve contributing physical IDs and official street names in the locked selection.

The Bryant Park fixture proved the ordinary case. Grand Central exposed multiple roadbeds and a viaduct, so complex nodes need an explicit limitation or later official naming fallback.

## Intersection selection to collision points

Use the selected official coordinate directly in the server-side Socrata query:

```text
within_circle(location, latitude, longitude, 50)
```

Also filter to calendar year 2025 and `location IS NOT NULL`. This is a spatial relationship, not an attribute join. Street-name fields may be absent and must not determine whether a point inside the circle is counted.

## Intersection circle to Priority Zones

`qzji-nvbd.the_geom` is a multipolygon. Fetch and cache the five source rows, create the selected 50-meter circle in WGS84 longitude/latitude order, and run a tested polygon-intersection operation.

Return only:

- `matched`;
- `not_matched`; or
- `unavailable`.

The source has no zone name, ID, borough, or ranking field.

## Coordinate rules

- The centerline and Priority Zone geometries use WGS84 longitude/latitude coordinates.
- Socrata `within_circle` takes named latitude and longitude arguments followed by meters.
- Geometry libraries commonly expect longitude/latitude array order.
- Add a test that fails when coordinate order or radius units are reversed.

## Companion collision tables

The Vehicles (`bm4k-52h4`) and Person (`f55k-p6yu`) tables are not required for the MVP. If used later, both join to Crashes through `collision_id`. A Person `vehicle_id` maps to Vehicles `unique_id`, not Vehicles `vehicle_id`.

Used by: [PRD §§7–13](../prd.md), [dataset-crashes](./dataset-crashes.md), [dataset-priority-zones](./dataset-priority-zones.md), and [dataset-nyc-street-centerline](./dataset-nyc-street-centerline.md).
