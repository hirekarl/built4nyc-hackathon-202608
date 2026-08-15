---
type: framework
status: candidate
source: general knowledge, not yet hands-on validated in this repo
---

# Map + draw library options

Not yet deeply researched against this repo's Next.js/Vercel stack — decide at `scaffold-nextjs-app` time. Options considered:

- **Mapbox GL Draw** (`@mapbox/mapbox-gl-draw` on top of `mapbox-gl` / `react-map-gl`) — polished polygon-draw UX out of the box, vector tiles render fast. Requires a Mapbox API key/token (free tier should cover a hackathon demo) and adds real bundle weight.
- **Leaflet.draw** (on top of `react-leaflet`) — lighter weight, no API key required for the base map (can use OSM tiles), draw plugin is older/less actively maintained but functional.
- **Turf.js** — not a map/draw library itself, but needed either way for polygon → WKT conversion and any client-side geometry helpers (e.g. area/overlap checks before hitting the API).

Open question to resolve at scaffold time: does the team want the visual polish of Mapbox (better for the "Design" judging criterion) or the zero-API-key simplicity of Leaflet (less setup risk during a time-boxed weekend)? Leaning Mapbox GL Draw for the design payoff, but confirm no API-key friction before committing.

Used by: [PRD §10 open questions](../prd.md#10-open-questions--risks).
