---
type: framework
status: adopted
source: hands-on temporary spike and provider documentation, 2026-08-15
---

# Map renderer: MapLibre GL JS with OpenFreeMap

The MVP does not use a freehand drawing library. It uses MapLibre GL JS to render official centerlines, accessible intersection hit targets, hover and selected states, and the 50-meter analysis circle.

## Accepted configuration

- Renderer: MapLibre GL JS.
- Hackathon basemap: OpenFreeMap Bright.
- Selection: application-owned centerline and intersection layers.
- Data loading: eligible centerlines by map viewport.
- Attribution: keep MapLibre's attribution control visible.
- Service fallback: retain screenshots or a recording because the public basemap has no service-level agreement.

## Verified spike

A temporary page used MapLibre GL JS 5.24.0 and OpenFreeMap Bright with an official W 40 ST/5 AVE point.

- The map and centerline overlay rendered.
- A 34-pixel interactive target supported an unobtrusive visible marker.
- Hover produced `Hover: W 40 ST at 5 AVE`.
- Click produced `Selected: W 40 ST at 5 AVE`.
- The temporary page and server were removed; no repository application code changed.

## Layer pattern

Use separate layers for:

- eligible centerlines;
- wide transparent or low-opacity hit targets;
- hover state;
- selected contributing streets;
- intersection targets; and
- the selected 50-meter boundary.

Do not rely on color alone. Provide keyboard focus and activation through an accessible companion control or equivalent map interaction.

## Rejected or deferred options

- Mapbox GL Draw and Leaflet.draw are unnecessary because polygons are out of MVP scope.
- A custom draggable Street View person is optional after the core report works.
- Native Street View Pegman is optional context and must not control the report boundary.

Used by: [PRD §6](../prd.md#6-frontend-interface-specification) and [ADR 0004](../adr/0004-maplibre-openfreemap.md).
