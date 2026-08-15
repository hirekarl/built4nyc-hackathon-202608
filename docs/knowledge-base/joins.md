---
type: reference
status: adopted (attribute join) / candidate (spatial joins)
source: verified against live Socrata API, 2026-08-15
---

# Dataset joins

How the datasets in [[dataset-crashes]], [[dataset-priority-zones]], and [[dataset-open-streets-locations]] (plus the two crash companion tables) relate to each other, verified live rather than assumed from field names.

## Attribute join: crashes ↔ vehicles ↔ person

All three share `collision_id` as a `number` field, same type on both sides, no conversion needed:

- `h9gi-nx95.collision_id` (Motor Vehicle Collisions - Crashes)
- `bm4k-52h4.collision_id` (Motor Vehicle Collisions - Vehicles)
- `f55k-p6yu.collision_id` (Motor Vehicle Collisions - Person)

Verified live: took the most recent crash's `collision_id` and confirmed the same value is present in both companion tables.

Row counts (verified via `$select=count(*)`): crashes 2,269,187 / vehicles 4,551,002 / person 5,984,110. Both companions are natural 1-to-many off `collision_id` (multiple vehicles and multiple people per crash) — the ratios are consistent with that.

### Gotcha: person → vehicle join key, verified by direct lookup

`f55k-p6yu.vehicle_id` does **not** join to `bm4k-52h4.vehicle_id`. It joins to `bm4k-52h4.unique_id`.

Verified: took a real `f55k-p6yu.vehicle_id` value (`19141108`) and looked it up two ways:

- As `bm4k-52h4.unique_id` → **one match**, with a matching `collision_id`. Correct join.
- As `bm4k-52h4.vehicle_id` → **zero matches**.

Why: `bm4k-52h4.vehicle_id` is a per-crash-scoped identifier with an inconsistent format across rows — sometimes a small sequence number (`"1"`, `"2"`), sometimes a UUID — while `bm4k-52h4.unique_id` is the table's real primary key, which is what `person.vehicle_id` actually references. Not needed for MVP scope (neither companion table is currently planned for use), but documented so this doesn't cost someone debugging time later.

## Spatial join: crashes ↔ priority zones ↔ open streets

The user-drawn polygon needs to be checked against all three geometry-bearing datasets, but they don't all support the same query strategy:

| Dataset | Geometry type | Query strategy |
| --- | --- | --- |
| Crashes (`h9gi-nx95`) | Point (`location`) | Server-side SoQL `within_polygon(location, 'POLYGON(...)')` — point-in-polygon, confirmed working live against the production endpoint. |
| Priority Zones (`qzji-nvbd`) | Multipolygon (`the_geom`), 5 rows | No server-side polygon-polygon function in SoQL. Fetch all 5 rows once (tiny), compute overlap client/server-side. |
| Open Streets (`uiay-nctu`) | Multiline (`the_geom`), 391 rows | No server-side line-polygon function in SoQL either. Fetch all 391 rows once (still small), compute intersection client/server-side. |

Both Priority Zones and Open Streets are small enough to match the existing "fetch once, cache/bundle at build time" plan in each dataset's KB entry — so the fetch-everything approach isn't just a workaround, it's already the intended access pattern for both.

**Recommended library:** Turf.js (`@turf/boolean-intersects` for a yes/no overlap check) — already referenced in [[framework-map-draw]] for WKT conversion, so this reuses that dependency rather than adding a new one.

**Coordinate system:** all three datasets use plain WGS84 lon/lat pairs — verified by inspecting raw coordinate values in each dataset's GeoJSON-shaped geometry fields (e.g. Priority Zones' `the_geom.coordinates` fall in the expected NYC lon/lat range). No projection conversion needed between datasets.

**Known gap before relying on this for petition copy:** Priority Zones has no borough/name/ID attribute to cite once an overlap is found — see [[dataset-priority-zones]] for the discrepancy this creates against the PRD's planned petition language. Open Streets overlap results are subject to the staleness caveat in [[dataset-open-streets-locations]] — an overlap found there reflects a lapsed 2024–2025 program window, not necessarily current status.

Used by: [PRD §6](../prd.md#6-data-sources).
