# Knowledge Base

Working notes on datasets, frameworks, and tools evaluated or adopted for this project, kept as we go so findings don't have to be re-derived each session. Each entry is a small Markdown file with frontmatter (`type`, `status`, `source`); this file is just the index — see the linked files for detail.

Format: one fact/finding per file, most-recent status first. `status: candidate` = researched but not yet committed to; `status: adopted` = actually in use; `status: rejected` = considered and ruled out (kept so we don't re-research it).

## Datasets

- [Motor Vehicle Collisions - Crashes](./dataset-crashes.md) — `h9gi-nx95`, core geospatial crash data. **adopted**
- [VZV Priority Zones or Areas](./dataset-priority-zones.md) — `qzji-nvbd`, DOT's own priority-corridor ranking. **adopted**
- [Open Streets Locations](./dataset-open-streets-locations.md) — `uiay-nctu`, existing Open Streets sites, dedup/context. **candidate**

## Frameworks & tools

- [Map + draw library options](./framework-map-draw.md) — Mapbox GL Draw vs. Leaflet.draw comparison. **candidate — decide at scaffold time**
- [Vercel AI SDK for petition generation](./framework-ai-sdk.md) — chosen approach for the LLM drafting step. **candidate**
