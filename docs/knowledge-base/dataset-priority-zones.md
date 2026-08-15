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

## Display constraint

The original product direction assumed the app could cite a specific zone name. **The dataset has no such attribute.** The 5-rows-for-5-boroughs pattern is a reasonable inference, but it is not confirmed by any field.

The report supports only:

- `Matched — the analysis boundary overlaps a DOT Vision Zero priority area`;
- `Not matched — no overlap was found`; or
- `Unavailable — the source could not be checked`.

Do not display a zone name, zone ID, borough-qualified zone, or ranking.

## Access pattern

- **Scale:** 5 rows, ~large geometries each — fetch once and cache/bundle at build time rather than querying live per-request (confirmed cheap: full dataset is small despite big polygons).
- **Spatial join with the selected circle:** `the_geom` is a multipolygon, not a point, so SoQL's `within_polygon` does not apply. Fetch the five rows and use a tested geometry operation between the 50-meter circle and each multipolygon. See [dataset joins](./joins.md).

## Why it matters for this project

The overlap adds official city context to the sourced safety report and makes the cross-dataset analysis visible. It does not change collision totals and must not be framed as a government endorsement or a named zone claim.

Used by: [PRD §§6–8](../prd.md), [ADR 0005](../adr/0005-deterministic-report-and-bounded-ai.md). Join details: [dataset joins](./joins.md).
