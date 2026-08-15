---
type: dataset
status: candidate
source: nyc-open-data-scout research, 2026-08-15
---

# Open Streets Locations

- **Socrata dataset ID:** `uiay-nctu`
- **Portal page:** <https://data.cityofnewyork.us/Health/Open-Streets-Locations/uiay-nctu>
- **What it is:** existing/active NYC Open Streets program sites.
- **Scale:** small (~1-2K rows) — fetch once, cache/bundle at build time.
- **Why it matters:** lets the app flag when a drawn polygon overlaps an _existing_ Open Street, so it doesn't generate a redundant petition for a street that's already designated.
- **Status note:** stretch goal per [PRD §6](../prd.md#6-data-sources) — first thing to cut if the weekend timeline is tight. The Priority Zones dataset ([[dataset-priority-zones]]) is the higher-value one to keep if only one context dataset makes the cut.
