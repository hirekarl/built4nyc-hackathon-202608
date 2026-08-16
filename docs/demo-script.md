---
type: demo-script
status: rehearsal-ready
source: revised 2026-08-16 for the 2:15 PM live judging round
---

# EZStreet — live judging package

For the in-person judging round at SNFL. Present the public app at <https://ezstreet.vercel.app>. This package has two parts:

1. **Script 1** is the timed, live-demo beats sheet.
2. **Script 2** is the background, claim guardrails, and Q&A sheet. It is not spoken unless a judge asks.

The target is three minutes and roughly 350–400 spoken words. Read current numbers from the screen: NYC may backfill historic collision data.

---

## Script 1 — timed live-demo beats

### Before the judges arrive

- Use production, not localhost.
- Complete one warm-up report, then reset the map with no selection.
- Keep the map centered on Bryant Park / Grand Central.
- Open [`docs/assets/screenshot-report.jpg`](./assets/screenshot-report.jpg) in a second tab as the fallback.
- Close devtools, silence notifications, and set browser zoom so the report is readable from a few feet away.
- One person presents and drives. One teammate is ready for technical questions. One teammate keeps the fallback ready.

### Beat 1 — local hook · 0:00–0:20

**Screen:** The unselected map around the library.

**Say:**

> We are at 455 Fifth Avenue. The corner outside this building is 40th and Fifth. In 2025, six crashes were reported within 50 meters of that corner. Seven people were injured, and one person was killed. That information is public, but it is not easy for a resident to find and verify.

**Proves:** NYC relevance, impact, and the first-30-second demo moment.

**Cut first:** “That information is public, but it is not easy for a resident to find and verify.”

### Beat 2 — product promise · 0:20–0:35

**Screen:** Hover one eligible intersection.

**Say:**

> EZStreet turns one official NYC intersection into a clear, sourced street-safety report. You do not enter an address or drop a pin. You select an intersection derived from the city’s official street-centerline records.

**Proves:** Product definition, design, and originality.

### Beat 3 — live map-to-report flow · 0:35–1:40

**Screen actions:**

1. Select `E 40 ST at 5 AVE at W 40 ST`.
2. Pause on the visible 50-meter boundary.
3. Select **Generate safety report**.
4. When the report appears, point to headline facts, Priority Zone, and sources.

**Say:**

> This is the city-derived name for the corner and a fixed 50-meter analysis boundary. The server verifies that selection against official centerline data, then queries NYC Open Data live.
>
> Here are the headline facts: six crashes, seven people injured, and one killed. The report also shows road-user breakdowns, contributing factors, and whether this boundary overlaps a Vision Zero Priority Zone.
>
> Every source is attached with its dataset name, ID, retrieval status, timestamp, and link. The report can also be printed or saved as a PDF.

**Proves:** Completion, theme, live NYC Open Data use, and the central user experience.

**Cut first:** Do not narrate individual road-user categories, factors, or the print action. Judges can see them.

### Beat 4 — why the report is trustworthy · 1:40–2:05

**Screen:** Keep the completed report and source list visible.

**Say:**

> Every report fact is calculated deterministically from documented city fields. If a source is unavailable, the report says Partial, keeps the facts it could verify, and marks missing values as Unavailable—never as a false zero. And a zero result is never presented as proof that an intersection is safe.

**Proves:** Technical depth, safety, and responsible design.

### Beat 5 — AI usage and human control · 2:05–2:30

**Screen:** Keep the report visible; do not switch to a technical diagram.

**Say:**

> We used Claude Code and Codex CLI to plan, test, and implement EZStreet. We separated planning, test-writing, implementation, and review, while humans made the product decisions and approved the final implementation pull requests. We deliberately kept language models out of the factual data path. A plausible but incorrect fatality count would be worse than no generated explanation.

**Proves:** Responsible AI use and human-in-the-loop control.

**Cut first:** “A plausible but incorrect fatality count would be worse than no generated explanation.”

### Beat 6 — learning, impact, close · 2:30–3:00

**Say:**

> Our biggest technical lesson was that NYC Open Data does not provide the ready-made selectable intersection layer we needed. We derived it from official centerline endpoints, then connected it to collision and Priority Zone data. EZStreet gives residents a shareable report they can inspect, print, and verify. EZStreet: street facts, clearly sourced.

**Proves:** Learning, originality, and impact.

### If the live demo breaks

- **Map or Wi-Fi fails:** Switch to the screenshot. Say: “Here is the report the live app produces from the same public NYC data.” Do not debug in front of judges.
- **The report is Partial:** Say: “This is the failure state we designed for: it keeps verified facts and identifies what is unavailable. It does not invent a zero.”
- **The numbers changed:** Read the screen. Say: “NYC backfills reported collision data, so this report shows the current source result and retrieval time.”

---

## Script 2 — background, guardrails, and Q&A

### Product facts

| Topic | Accurate answer |
| --- | --- |
| Product | EZStreet lets a user select one official NYC intersection and receive a sourced street-safety report. |
| Scope | Intersections only, a fixed 50-meter circle, and calendar year 2025. |
| Demo result | At the time of rehearsal: 6 crashes, 7 people injured, and 1 person killed at `E 40 ST at 5 AVE at W 40 ST`. Always use the live screen as the source for the current result. |
| Source roles | NYC Street Centerline (`inkn-q76z`) supplies selection geometry and names; Motor Vehicle Collisions – Crashes (`h9gi-nx95`) supplies crash metrics; VZV Priority Zones or Areas (`qzji-nvbd`) supplies contextual overlap. |
| Data meaning | The report counts **reported crashes** inside the displayed circle during 2025. It is not a safety score, prediction, causation claim, or engineering recommendation. |
| Missing data | `0` means a successful query returned no matches. `Unavailable` means the required data could not be computed. |
| Privacy | No account, saved report, or personal input is required for this MVP. |

### Technical proof points

- Next.js and TypeScript on Vercel.
- MapLibre with OpenFreeMap tiles for the map.
- Server-side validation and re-resolution of the selected intersection.
- Socrata geospatial queries for collision data.
- Geometric Priority Zone overlap against the 50-meter circle.
- Unit tests, end-to-end tests, accessibility scans, type checks, and production build checks.

### Claim guardrails

| Say this | Do not say this |
| --- | --- |
| “The final implementation pull requests received human approval.” | “`main` requires approving review.” |
| “We separated planning, test-writing, implementation, and review roles.” | “The test-writing agent technically could not edit implementation.” |
| “NYC Open Data does not provide the ready-made selectable intersection layer we needed.” | “NYC has no intersection dataset at all.” |
| “The report is a shareable document with numbers, limitations, and citations.” | “A community board specifically asks for this exact paper.” |

### Known limitations

- This MVP analyzes intersections, not a whole street segment.
- Multi-roadbed nodes around Grand Central remain separate candidates rather than one simplified intersection name.
- NYC may backfill historic collision reports, so figures can change after retrieval.
- Reported crashes do not represent every incident or current street conditions.
- No user study or measured time-saving claim has been completed.
- Street View, petitions, permits, editable exports, saved reports, and a user-facing AI explanation are deferred features, not current claims.

### Likely judge questions

| Question | Short answer |
| --- | --- |
| Where is the AI? | We used Claude Code and Codex CLI to build and test EZStreet, with humans making decisions and approving final implementation work. No model generates or changes report facts. |
| Why no AI-generated report? | A report about injuries and deaths needs reproducible facts. We scoped a bounded explanation feature but did not ship it under deadline pressure. |
| Is this real data? | Yes. The report queries three NYC Open Data datasets at report time and displays each source on the result. |
| Why only 2025? | It is a complete calendar year, so the report does not compare a partial year with a full one. |
| Why 50 meters? | It is a fixed, server-enforced boundary so the same intersection is analyzed consistently by every user. |
| Why only intersections? | That is the focused MVP. Street-segment analysis needs a different line-buffer method and is a future extension. |
| Does a zero mean the street is safe? | No. It only means no reported crashes matched the defined boundary and period. |
| What happens when a source fails? | The report becomes Partial, keeps valid facts, identifies the unavailable source, and lets the user retry. |
| Why does the name include E 40, 5 AVE, and W 40? | Fifth Avenue divides East and West 40th Street. Those official centerline segments meet at the same coordinate, so EZStreet preserves the city-derived grouping rather than inventing a simpler name. |
| Could the numbers change? | Yes. NYC can backfill records. The report shows the retrieval time, and we read the live result during the demo. |
| What would you build next? | Multi-year comparison, street-segment analysis, and the bounded plain-language explanation we deliberately deferred. |
| Can this replace city or engineering advice? | No. It is a sourced information tool, not a safety rating or regulatory recommendation. |

### Presenter quick reference

- Live app: <https://ezstreet.vercel.app>
- Repository: <https://github.com/hirekarl/ezstreet>
- Tracks: General and Best Use of NYC Open Data.
- First answer: give one sentence. Add technical detail only if the judge asks.
- If a judge asks about an unbuilt feature, state that it is deferred instead of promising it as current functionality.
