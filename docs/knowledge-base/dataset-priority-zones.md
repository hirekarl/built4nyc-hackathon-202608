---
type: dataset
status: adopted
source: nyc-open-data-scout research, 2026-08-15
---

# VZV Priority Zones or Areas

- **Socrata dataset ID:** `qzji-nvbd`
- **Portal page:** <https://data.cityofnewyork.us/Transportation/VZV-Priority-Zones-or-Areas/qzji-nvbd>
- **What it is:** DOT's own KSI-density-ranked (killed/severely injured) priority corridors, per borough — the city's official Vision Zero prioritization methodology.
- **Scale:** small, borough-level dataset — fetch once and cache/bundle at build time rather than querying live per-request.
- **Why it matters for this project:** this is the strongest originality/legitimacy anchor in the whole app. Checking whether a user-drawn polygon overlaps a DOT-designated Priority Zone lets the generated petition say "this segment falls within DOT's own Priority Zone X" — a cross-dataset synthesis not exposed anywhere in NYC's existing Vision Zero View tool, and the core of the Best Use of NYC Open Data pitch.

Used by: [PRD §6](../prd.md#6-data-sources), [PRD §8 design](../prd.md#8-design--ux-priorities) (Priority Zone match badge).
