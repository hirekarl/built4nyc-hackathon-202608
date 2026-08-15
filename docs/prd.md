# Product Requirements Document: Vision Zero Sandbox

Status: draft, pre-scaffold. Idea evaluated and approved against the judging rubric — see `.claude/plans/rayan-proposed-the-following-validated-backus.md` for that evaluation (local, not checked in). This PRD is the source of truth for scope going into `scaffold-nextjs-app`.

## 1. Problem

New Yorkers who witness dangerous conditions on a specific block or corridor — frequent near-misses, speeding, a lack of a safe crossing — often know exactly where the problem is but have no easy way to back that knowledge with data when petitioning the city. NYC DOT's Open Streets and Street Pedestrian Plaza programs both accept community-driven applications, but building a credible case today means manually cross-referencing NYPD collision records, figuring out DOT's own street-safety prioritization, and writing a formal petition — a research and writing burden most residents won't take on alone.

## 2. Solution

Vision Zero Sandbox is a web app where a user draws a polygon over a specific street segment or plaza-candidate area on a map. The app queries NYC's live collision data for that exact shape, summarizes the safety case (crash counts, injuries/fatalities, top contributing factors), checks whether the area falls inside a DOT-designated Priority Zone, and uses an LLM to draft a petition letter grounded in that data — supporting an application to DOT's existing Open Streets / Street Pedestrian Plaza program. The user reviews and edits the draft before copying or downloading it; the app never submits anything on the user's behalf.

## 3. Goals & non-goals

**Goals (MVP, weekend-scoped):**

- Let a user draw an arbitrary polygon on a NYC map.
- Query collision data scoped to that polygon and a recent date range, server-side.
- Surface a clear safety summary: total crashes, injuries, fatalities, top contributing factors, within the drawn area.
- Check polygon overlap against DOT's Priority Zones dataset and surface that as supporting context.
- Generate a draft petition letter via an LLM, grounded in the fetched summary — with an explicit human review/edit step before export.
- Ship a working demo deployed on Vercel.

**Non-goals (explicitly out of scope for the hackathon submission):**

- No user accounts, auth, or saved history across sessions.
- No direct submission to DOT or any government system — copy/download only.
- No editing/persisting of past petitions; each session is stateless.
- No mobile app; responsive web only, desktop-first for the drawing interaction.
- No support for multiple concurrent AI providers/models — pick one and move on.
- No moderation/abuse-prevention system beyond basic rate limiting on the AI route (out of scope to build a queueing/anti-abuse system for a weekend demo, but see §7 on cost control).

## 4. Users & use case

Primary user: an NYC resident, community board member, or block association member who has identified a specific unsafe street segment and wants a data-backed starting point for a DOT petition. They are not expected to know GIS, SoQL, or anything about the underlying datasets — the app's job is to translate "this exact shape on the map" into "here's the case, and here's a draft letter."

## 5. Core user flow

1. User lands on the app and sees a map centered on NYC (e.g. Manhattan default, or geolocated if permitted).
2. User selects a draw tool and traces a polygon over the block/corridor/plaza-candidate area they care about.
3. On completing the shape, the app:
   - Converts the drawn polygon to WKT (`POLYGON((lon lat, ...))`) — coordinate order is longitude-latitude, opposite of typical draw-library output, so this conversion needs explicit, tested handling.
   - Queries `Motor Vehicle Collisions - Crashes` (Socrata `h9gi-nx95`) via SoQL `within_polygon`, scoped by a recent date lower bound (e.g. last 5 years) and `location IS NOT NULL`.
   - Checks the polygon against the `VZV Priority Zones or Areas` dataset (`qzji-nvbd`) for overlap.
4. The app displays a summary panel: crash count, injury/fatality totals, ranked contributing factors, and a Priority Zone match/no-match indicator.
5. User clicks "Draft petition." The app sends the summary (not raw AI-facing user input) to an LLM with a prompt template that produces a formal petition letter addressed to DOT, citing the specific data.
6. The draft renders in an editable text area. User can revise freely, then copy or download it as text/markdown. No submission action exists in the app.

## 6. Data sources

| Dataset | Socrata ID | Purpose | Access pattern |
| --- | --- | --- | --- |
| Motor Vehicle Collisions - Crashes | `h9gi-nx95` | Core safety data for the drawn polygon | Live SoQL query per request, server-side (Next.js API route), scoped by `within_polygon` + date lower bound |
| VZV Priority Zones or Areas | `qzji-nvbd` | Legitimacy/context anchor — is this area already a DOT-flagged priority corridor | Fetched once, cached/bundled at build time (small, borough-level dataset) |
| Open Streets Locations | `uiay-nctu` | Optional: flag if the drawn area overlaps an existing Open Street, to avoid a redundant petition | Fetched once, cached/bundled at build time; stretch goal, cut first if time-constrained |

Gotchas carried over from dataset research (see plan file for full detail): some crash rows have null lat/long (filter them out); register a Socrata `X-App-Token` ahead of demo day to avoid rate-limit surprises; always query server-side and scoped, never fetch-all-then-filter given the dataset's multi-million-row size.

## 7. AI usage

- One LLM call per petition draft, triggered explicitly by the user (no background/automatic generation).
- Input to the model is the structured summary computed server-side (crash counts, top factors, Priority Zone match), not arbitrary free-text injected into a system prompt — reduces prompt-injection surface and keeps output grounded in real numbers.
- Output is always presented as an editable draft, never auto-copied, auto-downloaded, or auto-submitted — this is the human-in-the-loop story for the "AI Usage & Technology" judging criterion.
- Use the Vercel AI SDK (per repo stack conventions) for the generation call; pick a single provider/model at scaffold time rather than building multi-provider abstraction — see `vercel:ai-sdk` skill when implementing.
- Basic guardrail: cap petition generation to a reasonable rate per session/IP to control API cost during the demo period, not a full abuse-prevention system.

## 8. Design & UX priorities

Per `docs/judging-criteria.md`, design is scored standalone from functionality — budget real time for this, not just correctness:

- The map and draw interaction should feel immediate and obvious (clear draw/undo/clear-shape affordances, visible polygon while drawing).
- The data summary should read as a "safety case," not a raw data dump — lead with the numbers that matter (injuries, fatalities, top factor), not a table dump of every field.
- The Priority Zone match should be visually distinct (e.g. a badge/callout), since it's the key originality/legitimacy signal.
- The petition draft view should clearly separate "AI-generated, please review" from a finished document — don't let it look like a ready-to-send official letter without user action.

## 9. Success criteria for the hackathon submission

- End-to-end demo works live without visible bugs: draw → summary → priority zone check → AI draft → edit → copy/download.
- Submission clearly demonstrates novel use of NYC Open Data (polygon-scoped aggregation + cross-dataset Priority Zone check), positioning it for the Best Use of NYC Open Data track.
- Demo video/presentation calls out the human-in-the-loop design explicitly (per judging criteria).
- Deployed and reachable via a public Vercel URL before the Sunday 2:00 PM ET submission deadline.

## 10. Open questions / risks

- **Map + draw library choice** — Mapbox GL Draw vs. Leaflet.draw vs. a lighter alternative; affects bundle size, styling control, and how much of the "Learning" story leans on this piece. Decide at scaffold time.
- **LLM provider/model choice** — not yet selected; decide during `scaffold-nextjs-app` per `vercel:ai-sdk` guidance.
- **Time budget for Open Streets overlap check (§6, stretch)** — first thing to cut if the weekend runs short; Priority Zone check is the higher-value dataset to keep.
- **Socrata app token provisioning** — needs to happen early (5-minute task) so it isn't a demo-day surprise; track as a scaffold-time setup step, not a code task.
