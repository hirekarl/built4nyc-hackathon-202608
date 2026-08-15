---
type: dataset
status: adopted
source: nyc-open-data-scout research, 2026-08-15
---

# Motor Vehicle Collisions - Crashes

- **Socrata dataset ID:** `h9gi-nx95`
- **SODA endpoint:** `https://data.cityofnewyork.us/resource/h9gi-nx95.json`
- **Portal page:** <https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95>
- **Coverage:** 2012–present, ~2.2M+ rows, updated daily.
- **Key fields:**
  - `location` — Socrata Point type (lat/long as `latitude`/`longitude` strings too), supports `within_polygon`/`within_circle` SoQL functions.
  - `crash_date`, `crash_time`.
  - `contributing_factor_vehicle_1` … `_5` — free-text categories (e.g. "Failure to Yield Right-of-Way", "Aggressive Driving/Road Rage", "Unspecified").
  - `number_of_persons_injured`, `number_of_persons_killed`.
- **Geospatial query confirmed feasible:** SoQL `within_polygon(location, 'POLYGON((lon lat, lon lat, ...))')` — coordinate order is **longitude latitude**, opposite of typical Leaflet/Mapbox draw output. Convert carefully; this is a real bug source.
- **Data quality caveat:** a meaningful minority of rows have null `location`/lat-long. Always filter `location IS NOT NULL` before polygon queries.
- **Scale caveat:** never fetch-all-then-filter — always scope server-side by `within_polygon` + a `crash_date` lower bound (e.g. last 3–5 years) and a `$limit`.
- **Auth:** no token required for low-volume demo use, but register a Socrata `X-App-Token` (5 min, at data.cityofnewyork.us/profile/app_tokens) before demo day to avoid rate-limit surprises on the unthrottled tier (~1000 req/rolling window).
- **Companion tables** (joinable by `collision_id`, not needed for MVP): Motor Vehicle Collisions - Vehicles (`bm4k-52h4`), Motor Vehicle Collisions - Person (`f55k-p6yu`).

Example query:

```text
GET https://data.cityofnewyork.us/resource/h9gi-nx95.json
  ?$select=crash_date,contributing_factor_vehicle_1,contributing_factor_vehicle_2,number_of_persons_injured,number_of_persons_killed,location
  &$where=within_polygon(location, 'POLYGON((-73.99 40.73, -73.98 40.73, -73.98 40.74, -73.99 40.74, -73.99 40.73))') AND crash_date > '2019-01-01' AND location IS NOT NULL
  &$limit=5000
```

Used by: [PRD §6](../prd.md#6-data-sources).
