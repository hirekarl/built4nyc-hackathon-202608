# Knowledge Base

Working notes on datasets, frameworks, and tools evaluated or adopted for this project, kept as we go so findings don't have to be re-derived each session. Each entry is a small Markdown file with frontmatter (`type`, `status`, `source`); this file is just the index — see the linked files for detail.

Format: one fact/finding per file, most-recent status first. `status: candidate` = researched but not yet committed to; `status: adopted` = actually in use; `status: rejected` = considered and ruled out (kept so we don't re-research it).

## Datasets

- [Motor Vehicle Collisions - Crashes](./dataset-crashes.md) — `h9gi-nx95`, core geospatial crash data, 2.27M rows verified. **adopted**
- [VZV Priority Zones or Areas](./dataset-priority-zones.md) — `qzji-nvbd`, DOT's priority-corridor polygons; verified 5 rows, **no borough/name/ID attribute** — see file for petition-copy implications. **adopted, schema caveat**
- [Open Streets Locations](./dataset-open-streets-locations.md) — `uiay-nctu`, 391 rows; verified **every row's program window has already lapsed** (newest end date 2025-07-31) — see file for staleness impact on the redundancy check. **candidate**
- [Dataset joins](./joins.md) — verified join keys: `collision_id` across crashes/vehicles/person (with a person→vehicle FK gotcha), plus the client-side spatial-join approach for the two polygon/line datasets. **reference**

## Frameworks & tools

- [Map + draw library options](./framework-map-draw.md) — Mapbox GL Draw vs. Leaflet.draw comparison. **candidate — decide at scaffold time**
- [Vercel AI SDK for petition generation](./framework-ai-sdk.md) — chosen approach for the LLM drafting step. **candidate**
