# Knowledge Base

Working notes on datasets, frameworks, and tools evaluated or adopted for this project, kept as we go so findings don't have to be re-derived each session. Each entry is a small Markdown file with frontmatter (`type`, `status`, `source`); this file is just the index — see the linked files for detail.

Format: one fact/finding per file, most-recent status first. `status: candidate` = researched but not yet committed to; `status: adopted` = actually in use; `status: rejected` = considered and ruled out (kept so we don't re-research it).

## Datasets

- [NYC Street Centerline](./dataset-nyc-street-centerline.md) — `inkn-q76z`, official street geometry, names, nodes, and physical IDs used for viewport loading and intersection selection. **adopted**
- [Motor Vehicle Collisions - Crashes](./dataset-crashes.md) — `h9gi-nx95`, core geospatial crash data queried with `within_circle`; two live 2025 fixtures verified. **adopted**
- [VZV Priority Zones or Areas](./dataset-priority-zones.md) — `qzji-nvbd`, DOT priority-area multipolygons; verified 5 rows and **no borough/name/ID attribute**. **adopted, schema caveat**
- [Open Streets Locations](./dataset-open-streets-locations.md) — `uiay-nctu`; optional research retained from the former petition direction and not used by the MVP. **deferred**
- [Dataset joins and spatial relationships](./joins.md) — centerline-node selection, collision radius queries, and Priority Zone overlap. **reference**

## Frameworks & tools

- [Map renderer](./framework-map-draw.md) — MapLibre GL JS with OpenFreeMap Bright; hover/click spike passed. **adopted**
- [Vercel AI SDK for optional report explanation](./framework-ai-sdk.md) — bounded AI role and unresolved model-provider setup. **optional**

## Regulations

- [NYC DOT Open Streets 2026 application requirements](./regulation-open-streets-application.md) — retained research for an optional future petition or permit feature; not part of the MVP. **deferred**
