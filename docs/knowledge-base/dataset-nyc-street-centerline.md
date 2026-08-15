---
type: dataset
status: adopted
source: official NYC Open Data metadata and live SODA queries, 2026-08-15
---

# NYC Street Centerline

- **Catalog map view:** `3mf9-qshr`
- **Underlying SODA dataset ID:** `inkn-q76z`
- **SODA endpoint:** `https://data.cityofnewyork.us/resource/inkn-q76z.json`
- **Portal page:** <https://data.cityofnewyork.us/City-Government/Centerline/3mf9-qshr>
- **Provider:** NYC Office of Technology and Innovation
- **Update frequency:** weekly, according to portal metadata
- **Row count verified August 15, 2026:** 122,244

## MVP role

Official centerline data supplies the selectable map geometry and intersection identity. The application must not derive official street names from the basemap or let users replace the locked selection with free text.

Use centerline records for:

- street geometry loaded by the visible map viewport;
- official street names;
- shared endpoint coordinates used to form intersection candidates; and
- physical IDs retained in the report request for provenance.

Verified fields needed by the adapter include `the_geom`, `physicalid`, `rw_type`, `nonped`, `from_level_code`, `to_level_code`, `full_street_name`, `street_name`, `stname_label`, `b5sc`, `bphys_id`, and `globalid`.

## Eligibility filter

The MVP exposes ordinary physical surface streets. Official `rw_type` metadata defines `1` as Street, `2` as Highway, `3` as Bridge, `4` as Tunnel, `6` as Path/Trail, `9` as Ramp, `10` as Alley, and `12` as Non-Physical Street Segment. The live dataset returned the same coded values.

The initial eligibility filter should require `rw_type = '1'` and a blank `nonped` value. This excludes vehicle-only `V` records and DOE-excluded `D` records from the selectable MVP surface. Record this as an adapter test rather than inferring eligibility from appearance.

The filter therefore excludes:

- highways;
- tunnels;
- ramps;
- alleys;
- pedestrian paths or non-street paths;
- `nonped` records; and
- nonphysical records.

Use `from_level_code` and `to_level_code` to identify grade complexity for naming and limitations. Do not silently collapse different roadbeds or levels into one ordinary intersection.

## Verified naming spike

A local spike used 156 official centerline rows from Bryant Park and Grand Central viewports.

- Physical ID `183093` resolved to `W 40 ST between 5 AVE and AVE OF THE AMERICAS` through exact shared endpoint coordinates.
- Grand Central exposed multiple Park Avenue roadbeds and `PARK AVE VIADUCT`, proving that complex nodes cannot always be collapsed into one ordinary intersection name.

Decision: continue with exact shared-coordinate naming for ordinary intersections. Treat a complex name as a limitation until a documented LION, Geosupport, or equivalent official fallback is selected.

## Viewport access pattern

- Query only the current viewport plus a small movement buffer.
- Cancel or ignore stale responses after the viewport changes.
- Normalize source features behind one adapter before passing them to the map.
- Build visible intersection candidates from eligible centerline endpoints.
- Keep official source identifiers with the selected candidate.
- Do not load the full city dataset into initial browser state.

Used by: [PRD §§5–8](../prd.md), [ADR 0003](../adr/0003-intersection-selection-and-analysis-boundary.md).
