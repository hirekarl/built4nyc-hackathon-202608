# 0004 - Use MapLibre GL JS with OpenFreeMap

Status: Accepted

## Context

The map must render a production basemap, official centerline geometry, accessible intersection hit targets, hover and selected states, and a 50-meter boundary. The hackathon build should avoid a map-provider key when possible and must preserve attribution.

A temporary spike using MapLibre GL JS 5.24.0 and OpenFreeMap Bright rendered the map and an official W 40 ST/5 AVE selection target. A 34-pixel hit target produced the expected hover and click states. No application code was created during the spike.

## Decision

Use MapLibre GL JS as the map renderer and OpenFreeMap Bright as the hackathon basemap.

- Keep OpenFreeMap/OpenMapTiles/OpenStreetMap attribution visible.
- Render centerlines and intersections as application-owned layers above the basemap.
- Use separate visible and hit-target layers so selection remains usable without oversized markers.
- Load centerlines by viewport.
- Keep a screenshot or recorded demo fallback because the public basemap has no service-level agreement.

## Alternatives considered

- **Mapbox GL Draw:** rejected because freehand polygon drawing is no longer part of the MVP and the provider adds token setup.
- **Leaflet.draw:** rejected because drawing is no longer required and MapLibre passed the needed vector-layer interaction spike.
- **Raw OpenStreetMap raster tiles:** used in an early render spike but not selected as the production basemap configuration.

## Consequences

The frontend must load MapLibre client-side within Next.js, preserve attribution, and distinguish a basemap outage from report-data failures. OpenFreeMap requires no application key for the selected public style, but its availability is not guaranteed. The report flow must remain demonstrable through a recorded fallback if map tiles fail during judging.
