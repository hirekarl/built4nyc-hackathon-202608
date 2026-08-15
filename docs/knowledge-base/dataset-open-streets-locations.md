---
type: dataset
status: candidate — staleness caveat, see below
source: verified against live Socrata API (metadata + full-table aggregates), 2026-08-15
---

# Open Streets Locations

- **Socrata dataset ID:** `uiay-nctu`
- **Portal page:** <https://data.cityofnewyork.us/Health/Open-Streets-Locations/uiay-nctu>
- **What it is:** NYC Open Streets program sites with DOT-approved schedules — but see the staleness finding below before calling these "existing/active."
- **Row count (verified via `$select=count(*)`):** 391.

## Full column list (verified via `/api/views/uiay-nctu.json`) — 27 columns, Esri shapefile-export field names (truncated to ~10 chars)

| Column | Type | Notes |
| --- | --- | --- |
| `object_id` | `number` | Sequential record count, not a stable external ID. |
| `orgname` | `text` | Hosting organization name (school, community org, etc.). |
| `appronstre` | `text` | Approved street name. |
| `boroughname` | `text` | Full borough name, e.g. `"Staten Island"` — **mixed case**, unlike crashes' `borough` which is all-caps. Don't assume the same casing convention across datasets. |
| `apprfromst` / `apprtostre` | `text` | Cross streets bounding the segment. |
| `apprdayswe` | `text` | Comma-separated lowercase weekday abbreviations, e.g. `"mon,tue,wed,thu,fri"`. |
| `reviewstat` | `text` | Verified distinct values via `$group=reviewstat`: `approvedFull` (209), `approvedLimited` (104), `approvedFullSchools` (78). No rejected/pending statuses appear in the live data — everything currently returned is some flavor of approved. |
| `apprmonope`/`apprmonclo` … `apprsunope`/`apprsunclo` | `text` | One open/close time pair per weekday (`apprmonope`, `apprmonclo`, `apprtueope`, `apprtueclo`, … through `apprsunope`/`apprsunclo`), `HH:MM` 24h, only populated for days the segment is actually open (per `apprdayswe`). |
| `apprstartd` / `apprenddat` | `calendar_date` | Program window start/end. **See staleness finding below — this is the field that matters most for the "is it currently active" question.** |
| `shape_stle` | `text` | Despite the name, this is the street segment length in feet (Esri auto-generated), not a style field. |
| `segmentidt` / `segmentidf` | `text` | LION segment IDs ("to"/"from") — potential future join to DCP's LION street-centerline dataset, not needed for MVP. |
| `lionversion` | `text` | LION dataset version this record was matched against (e.g. `"23C"`). |
| `the_geom` | `multiline` | **Not a polygon or point** — these are street segments (lines), not areas. WGS84 lon/lat, no projection conversion needed. `the_geom IS NULL` count verified as **0** — no missing geometry, unlike crashes. |

## Critical staleness finding — verified, not assumed

Verified via `min/max(apprstartd)` and `min/max(apprenddat)` across the full table:

- `apprstartd` ranges **2024-01-01 to 2024-12-08**.
- `apprenddat` ranges **2024-04-21 to 2025-07-31**.

**Every one of the 391 rows has a program window that has already ended** relative to the app's "today" (2026-08-15) — the newest `apprenddat` in the entire dataset is over a year in the past. This dataset reflects a past program cycle (looks like the 2024–2025 Open Streets year), not a live/current registry as of the app's build/demo date.

**Impact on the stretch goal** ("flag if the drawn area overlaps an _existing_ Open Street, to avoid a redundant petition," PRD §6): an overlap against this data does not mean the street is _currently_ an Open Street — the program may not have renewed, may have moved, or may simply not be in this snapshot yet. Recommendations:

- Re-check dataset freshness close to demo day — the portal may publish a newer program-year snapshot before Aug 16, 2026, but as researched now (2026-08-15) it has not.
- If shipped as-is, caveat the UI copy explicitly ("was an Open Street as of the 2024–2025 program year") rather than implying current status.
- This is an additional reason (beyond the existing "cut first if time-constrained" note) to deprioritize this dataset — [[dataset-priority-zones]] remains the higher-value, non-stale context dataset to keep if only one makes the cut.

## Access pattern

- Small (391 rows) — fetch once, cache/bundle at build time.
- Spatial join with the user-drawn polygon: `the_geom` is a multiline, not a point, so `within_polygon` doesn't apply directly. See [[joins]] for the recommended client-side (Turf.js) approach, same as Priority Zones.

Status note: stretch goal per [PRD §6](../prd.md#6-data-sources) — first thing to cut if the weekend timeline is tight, now doubly so given the staleness finding above.
