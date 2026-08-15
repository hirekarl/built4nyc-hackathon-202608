---
type: dataset
status: adopted
source: verified against live Socrata API (metadata + full-table aggregates), 2026-08-15
---

# Motor Vehicle Collisions - Crashes

- **Socrata dataset ID:** `h9gi-nx95`
- **SODA endpoint:** `https://data.cityofnewyork.us/resource/h9gi-nx95.json`
- **Portal page:** <https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95>
- **Row count (verified via `$select=count(*)`):** 2,269,187.
- **Coverage (verified via `min/max(crash_date)`):** 2012-07-01 to 2026-06-11. Portal metadata states the dataset is updated daily, but the verified max `crash_date` is ~2 months behind the verification date (2026-08-15) — likely NYPD reporting lag, not a stale feed. Don't assume same-day or same-week crash rows will be present.

## Full column list (verified via `/api/views/h9gi-nx95.json`)

| Column | Type | Notes |
| --- | --- | --- |
| `crash_date` | `calendar_date` |  |
| `crash_time` | `text` | `H:MM` 24h, no leading zero on the hour (e.g. `"6:30"`, `"13:08"`) — not zero-padded, don't assume fixed width when parsing. |
| `borough` | `text` | One of `BRONX` / `BROOKLYN` / `MANHATTAN` / `QUEENS` / `STATEN ISLAND`, always upper-case, no borough codes. See null-rate caveat below. |
| `zip_code` | `text` | Not `number` — don't cast; some rows have leading/format quirks typical of ZIP-as-string data. |
| `latitude` / `longitude` | `number` | Duplicated inside `location` too. |
| `location` | `location` (Socrata compound point type) | Shape: `{latitude, longitude, human_address}`. `human_address` is always an empty-field JSON string (`{"address":"","city":"","state":"","zip":""}`) in every sample pulled — don't rely on it for display. Supports `within_polygon`/`within_circle` SoQL functions. |
| `on_street_name` / `off_street_name` | `text` |  |
| `cross_street_name` | `text` | **Mutually exclusive with `on_street_name`/`off_street_name` per row** — a given row has either the on/off pair or `cross_street_name`, essentially never a reliable combination of all three. `cross_street_name` sometimes has a house-number prefix jammed into the string, e.g. `"3468      RICHMOND RD"` — don't assume it's a clean street name. |
| `number_of_persons_injured` / `number_of_persons_killed` | `number` |  |
| `number_of_pedestrians_injured` / `_killed` | `number` |  |
| `number_of_cyclist_injured` / `_killed` | `number` |  |
| `number_of_motorist_injured` / `_killed` | `number` |  |
| `contributing_factor_vehicle_1` … `_5` | `text` | Free-text category (e.g. "Failure to Yield Right-of-Way", "Aggressive Driving/Road Rage"). `"Unspecified"` is a common non-null placeholder value, not a true unknown — treat it as its own category, not as missing data. `_1` is populated far more often than `_2`–`_5`; don't assume all five are present. |
| `collision_id` | `number` | Primary key. Join key to companion tables (see [[joins]]). |
| `vehicle_type_code1`, `vehicle_type_code2`, `vehicle_type_code_3`, `vehicle_type_code_4`, `vehicle_type_code_5` | `text` | Note the inconsistent naming: `1`/`2` have no underscore before the digit, `_3`/`_4`/`_5` do — a real trap if you're generating field names programmatically instead of hardcoding them. |

## Verified data-quality findings

Each measured via `$select=count(*)&$where=<field> IS NULL` against the full 2,269,187-row table (not a sample):

- `location IS NULL`: **240,806 rows (~10.6%)**. Always filter `location IS NOT NULL` before polygon queries — confirms the existing plan.
- `borough IS NULL`: **691,375 rows (~30.5%)** — nearly 3x the null rate of `location`. Don't use `borough` as a proxy for "is this row usable," and don't gate the polygon-scoped query or any UI badge on `borough` being present — key everything off `location`/`within_polygon`, exactly as planned, since a null `borough` doesn't mean a null `location`.
- Distinct `borough` values and counts (verified via `$group=borough`): `BROOKLYN` 506,806, `QUEENS` 422,409, `MANHATTAN` 348,485, `BRONX` 234,088, `STATEN ISLAND` 66,024, plus the 691,375 null bucket. No unexpected/typo'd borough strings.

## Geospatial query — confirmed working live

SoQL `within_polygon(location, 'POLYGON((lon lat, lon lat, ...))')` — coordinate order is **longitude latitude**, opposite of typical Leaflet/Mapbox draw output. Convert carefully; this is a real bug source. Verified live (not just theoretical): ran the example query below against the production endpoint and got 3 real `collision_id`s back.

- **Scale caveat:** never fetch-all-then-filter — always scope server-side by `within_polygon` + a `crash_date` lower bound (e.g. last 3–5 years) and a `$limit`.
- **Auth:** no token required for low-volume demo use, but register a Socrata `X-App-Token` (5 min, at data.cityofnewyork.us/profile/app_tokens) before demo day to avoid rate-limit surprises on the unthrottled tier (~1000 req/rolling window).
- **Companion tables:** Motor Vehicle Collisions - Vehicles (`bm4k-52h4`), Motor Vehicle Collisions - Person (`f55k-p6yu`) — join by `collision_id`, not needed for MVP. Full join documentation, including a verified FK gotcha: [[joins]].

Example query (verified against the live endpoint):

```text
GET https://data.cityofnewyork.us/resource/h9gi-nx95.json
  ?$select=crash_date,contributing_factor_vehicle_1,contributing_factor_vehicle_2,number_of_persons_injured,number_of_persons_killed,location
  &$where=within_polygon(location, 'POLYGON((-73.99 40.73, -73.98 40.73, -73.98 40.74, -73.99 40.74, -73.99 40.73))') AND crash_date > '2019-01-01' AND location IS NOT NULL
  &$limit=5000
```

Used by: [PRD §6](../prd.md#6-data-sources).
