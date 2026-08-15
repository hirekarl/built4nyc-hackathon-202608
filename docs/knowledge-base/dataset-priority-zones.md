---
type: dataset
status: adopted — schema caveat, see below
source: verified against live Socrata API (metadata + full-table query), 2026-08-15
---

# VZV Priority Zones or Areas

- **Socrata dataset ID:** `qzji-nvbd`
- **Portal page:** <https://data.cityofnewyork.us/Transportation/VZV-Priority-Zones-or-Areas/qzji-nvbd>
- **What it is:** DOT's own KSI-density-ranked (killed/severely injured) priority corridors, per borough — the city's official Vision Zero prioritization methodology. This description is accurate per DOT's source methodology, but see below: it is **not** something the dataset's own columns can tell you.
- **Row count (verified via `$select=count(*)`):** exactly **5 rows**. Consistent with "one dense multipolygon per borough" (5 boroughs), but this is inference from the count, not confirmed by any attribute in the data — see below.

## Full column list (verified via `/api/views/qzji-nvbd.json`) — only 4 columns, total

| Column | Type | Notes |
| --- | --- | --- |
| `the_geom` | `multipolygon` | WGS84 lon/lat coordinates (verified by inspecting raw coordinate values — no projection conversion needed). |
| `sq_mi` | `number` | Area in square miles. |
| `shape_leng` | `number` | Perimeter length (source projection units, not miles/feet directly). |
| `shape_area` | `number` | Raw area in the source projection's units — **not the same value or unit as `sq_mi`**, don't conflate them. |

**There is no borough name, zone ID, zone name, or ranking/tier column.** Nothing in the data itself says which borough a given polygon belongs to, let alone a citable zone identity.

## Discrepancy vs. PRD/original KB assumption — read before writing petition-generation copy

The PRD (§6, §8) and the original version of this file described the app being able to say "this segment falls within DOT's own Priority Zone X" — that phrasing implies a citable zone name/ID. **The dataset has no such attribute.** The 5-rows-for-5-boroughs pattern is a reasonable guess but isn't confirmed by the data (no `borough` column to check it against).

Two ways to close this gap, neither implemented yet — flagging so whoever writes the AI-prompt/summary-panel copy sees it before assuming a zone name exists:

1. **Soften the copy** to "falls within a DOT Vision Zero priority area" (no specific zone name) — zero extra engineering.
2. **Derive the borough** the overlapping polygon belongs to via a separate step (e.g. reverse-geocode the polygon's centroid, or intersect against a real NYC borough-boundaries dataset) if a borough-qualified claim ("a Bronx priority area") is wanted. Adds a dependency on a 6th dataset or geocoding call — evaluate against remaining time budget.

## Access pattern

- **Scale:** 5 rows, ~large geometries each — fetch once and cache/bundle at build time rather than querying live per-request (confirmed cheap: full dataset is small despite big polygons).
- **Spatial join with the user-drawn polygon:** `the_geom` is a multipolygon, not a point, so SoQL's `within_polygon` (point-in-polygon) doesn't apply here. See [[joins]] for the recommended client-side approach (Turf.js) for polygon-polygon overlap.

## Why it matters for this project

This is the strongest originality/legitimacy anchor in the whole app, caveat above notwithstanding — checking whether a user-drawn polygon overlaps a DOT-designated Priority Zone is a cross-dataset synthesis not exposed anywhere in NYC's existing Vision Zero View tool, and the core of the Best Use of NYC Open Data pitch. Just don't let the generated copy claim a zone name/ID the data can't back up.

Used by: [PRD §6](../prd.md#6-data-sources), [PRD §8 design](../prd.md#8-design--ux-priorities) (Priority Zone match badge). Join details: [[joins]].
