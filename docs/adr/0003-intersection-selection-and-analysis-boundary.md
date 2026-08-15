# 0003 - Use official intersection selection and a fixed analysis boundary

Status: Accepted

## Context

The original concept asked users to draw arbitrary polygons. That interaction creates inconsistent analysis areas, requires polygon validation, and makes reports difficult to compare or explain. The project needs a selection method that is easy to demo, tied to official NYC street records, and precise enough for reproducible collision queries.

Live spikes tested official centerline data near Bryant Park and Grand Central and tested collision queries at 25, 50, 75, and 100 meters. A 100-meter circle at W 40 ST and 5 AVE began absorbing crashes from nearby blocks. The 50-meter query kept the selected intersection local while returning usable results at both fixtures.

## Decision

The MVP selects one official physical surface-street intersection and analyzes a fixed 50-meter circle centered on its official node.

- Load eligible official centerlines by map viewport.
- Use official street names, coordinates, and physical IDs.
- Exclude highways, tunnels, ramps, alleys, paths, non-pedestrian records, and nonphysical records.
- Show the circle before analysis and state `50 meters (about 164 feet)` in the interface and report.
- Use calendar year 2025 for the first slice.
- Keep the radius defined in one server-owned configuration location.

Freehand polygons are removed from the MVP. A street-centerline buffer may be tested later if intersection analysis is insufficient.

## Alternatives considered

- **Freehand polygon:** rejected for the MVP because shape size and placement make results inconsistent and add validation and UX risk.
- **100-meter intersection circle:** rejected because the Bryant Park spike began including nearby blocks.
- **25- or 75-meter circle:** both produced plausible results, but 50 meters was selected as the balanced initial boundary across the two test areas.
- **Street-line buffer first:** deferred because it introduces segment-end and width decisions that are not required for the intersection demo.

## Consequences

The map needs viewport-scoped centerline loading, accessible intersection hit targets, and a visible selected-circle layer. The server must reject unsupported radii and user-supplied raw geometry. Complex junctions such as the Park Avenue viaduct still need a documented naming fallback, but an ordinary intersection can support the first demo slice.
