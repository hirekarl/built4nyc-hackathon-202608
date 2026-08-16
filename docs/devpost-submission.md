# EZStreet — Devpost submission copy

Draft copy for the [Devpost entry](https://on.nypl.org/hack-dev), one block per form field, for team review before submitting. Nothing here claims anything the repo can't back up — every assertion traces to [`README.md`](../README.md), [`docs/adr/`](./adr/README.md), or [`docs/knowledge-base/`](./knowledge-base/README.md).

## Project name

```text
EZStreet
```

## Elevator pitch

Devpost caps this field at 200 characters; the text below is 161.

```text
Select any NYC intersection and get a deterministic, fully sourced street-safety report built from three NYC Open Data datasets. No AI anywhere in the data path.
```

## Tracks to select

- **General** (default for all entrants)
- **Best Use of NYC Open Data** — must be checked explicitly; judges will not infer it from the code

## "Try it out" links

```text
https://ezstreet.vercel.app
https://github.com/hirekarl/ezstreet
```

## Built With (tags)

```text
next.js, react, typescript, maplibre-gl, nyc-open-data, socrata, soql, turf.js, tailwindcss, vitest, playwright, axe-core, vercel
```

## Inspiration

NYC's collision data is public, but it isn't _accessible_. Answering an ordinary local question — "what has actually been reported at my corner?" — currently takes GIS knowledge, dataset research, and careful interpretation. The data sits in a Socrata portal behind a query language, spread across three datasets that don't obviously join.

That gap matters because a printed, sourced, one-corner safety report is exactly the artifact New Yorkers are already expected to produce and can't easily get: for an Open Streets or traffic-calming application, for community board testimony, for a school-crossing question, or for a reporter who needs a defensible figure under deadline.

So we picked the challenge of **access to city resources — specifically, access to the city's own street-safety record.**

## What it does

You select one official NYC street intersection on a map. EZStreet locks the city's own name for that intersection, draws a fixed 50-meter analysis boundary, and generates a deterministic street-safety report for calendar year 2025:

- Headline facts — crashes, people injured, people killed
- Road-user breakdown — pedestrians, cyclists, motorists, injured and killed
- Contributing factors, ranked, with unspecified counted separately
- Vision Zero Priority Zone overlap, tested geometrically
- Every dataset it used, with Socrata ID, role, availability status, and retrieval timestamp
- Data limitations, stated on the report itself

Then you print it, or save it as a PDF — as a real print document, not a screenshot of the screen.

Three things it deliberately refuses to do:

1. **It never invents a number.** If a source degrades, the report is labelled **Partial**, valid results are kept, the missing piece is named, and a retry is offered. A `null` metric renders as _Unavailable_; a `0` means a real query genuinely matched nothing. The two never collapse into each other.
2. **It never grades your street.** A zero result is reported as a zero result — never as evidence that a corner is safe.
3. **It never lets a language model touch a fact.**

## How we built it

Next.js 16 (App Router) on Vercel, TypeScript, MapLibre GL JS with OpenFreeMap tiles, and `@turf/boolean-intersects` for the geometry. Three NYC Open Data datasets, each with exactly one deterministic role, all queried live at request time:

| Dataset | Socrata ID | Role | How we query it |
| --- | --- | --- | --- |
| NYC Street Centerline | `inkn-q76z` | Selection geometry | `within_box` for the viewport in the browser; a WKT `intersects(POLYGON…)` window server-side, filtered to eligible surface streets |
| Motor Vehicle Collisions – Crashes | `h9gi-nx95` | Collision metrics | `within_circle(location, lat, lon, 50)` bounded to calendar year 2025 |
| VZV Priority Zones or Areas | `qzji-nvbd` | Priority-zone context | All five polygons fetched, then tested against the 50 m circle with a real geometric intersection |

**The novel part is the join, because NYC does not publish an intersection dataset.** Every intersection in the app is derived: we group street-centerline endpoints on an exact `longitude|latitude|level` key with no snapping tolerance, name each candidate from the city's own `stname_label`, and require at least two distinct eligible street names before offering it as selectable. So the thing you click and the name printed on the report are the city's record, not our guess.

Inputs are server-authoritative. The browser cannot supply a query, a radius, a period, or a replacement official name — the server scans every string in the request for query markers, checks the coordinate against an NYC bounding box, rebuilds the request from its own constants, and re-resolves the submitted intersection against the centerline data to within roughly a centimetre.

The app runs with **no API key** and no signup.

## Challenges we ran into

**NYC has no intersection dataset.** This was the real surprise, and it reshaped the project. Getting the derivation right — grouping, naming, the two-distinct-streets rule, and what to do about multi-roadbed nodes like Grand Central — took more work than the entire collision query.

**Modelling missing data honestly.** Deciding that `null` and `0` must never collapse into each other sounds academic until it propagates through the API contract, the type system, and eight distinct UI states. It's the decision we'd defend hardest.

**Failure signalling needed to be a two-way contract.** A _source of truth_ throws: with no resolved intersection there is no truthful report, so the centerline adapter raises and the route returns `503`. A _degradable source_ resolves to a status instead, so a missing Priority Zone check still yields a truthful `200 partial` report with the gap named. Picking "throw" for a degradable source would turn a legitimate partial report into a 500 for the whole request.

**Keeping a viewport-driven fetch cancellable** without leaking stale responses into the map.

## Accomplishments that we're proud of

**There is no LLM anywhere in the data path, and none at runtime in the live demo.** We used AI tools heavily to _build_ this — Claude Code and Codex CLI, all weekend — and then drew a hard line at the product. We had an "Explain this report" feature scoped and bounded by [ADR-0005](./adr/0005-deterministic-report-and-bounded-ai.md), and we [deferred it](https://github.com/hirekarl/ezstreet/issues/20) rather than ship it unbounded against a deadline. For a tool that reports fatalities at a specific corner, a plausible-sounding wrong number is worse than no feature.

**Human in the loop, with receipts:**

- `main` is branch-protected and requires a human approving review. No agent merged its own work.
- Decisions expensive to reverse were made by humans first, in [ADRs](./adr/README.md), before code existed.
- A commit hook rejects AI `Co-Authored-By` trailers. Authorship stays with the people accountable for the code.
- CI is the authority, not the model: lint, typecheck, ≥90% coverage, an accessibility scan, and a production build all gate merge.

**Design and accessibility were deliverables, not byproducts.** A map is a mouse-only control by default, so we built the other path too: a keyboard-navigable list of exactly the same intersection candidates in the viewport, with coordinates in each accessible name. The report drawer has eight explicit states, each with its own copy and live-region announcement — "no crashes matched" and "we couldn't reach the data" look and read completely differently, because they mean completely different things. And `@axe-core/playwright` asserts **zero accessibility violations** in CI across the map view, the report panel, and the print document.

**Quality gates that actually hold:** 275 tests, 99% coverage against a hard 90% floor, end-to-end Playwright flows against live NYC Open Data, and a clean production build — all enforced on every pull request.

## What we learned

None of us had built this before.

- **Socrata and SoQL geospatial querying** — `within_circle`, `intersects` with WKT polygon windows, and building a metre-accurate bounding box at NYC's latitude.
- **MapLibre GL's layer and interaction model** — sources, layers, hit targets, hover state, and cancellable viewport-driven fetches.
- **That NYC has no intersection dataset**, and what it takes to derive one defensibly.
- **Modelling missing data honestly**, and how far that decision reaches once you commit to it.
- **Running a multi-agent AI workflow across two different CLIs** — Claude Code and Codex CLI against one checked-in agent roster — without losing traceability of who, human or agent, decided what.

## What's next for EZStreet

- **"Explain this report"** — already scoped and bounded by ADR-0005: the model may only receive a finished report and restate it in plainer language, never compute, alter, hide, or gate a fact.
- Resolving multi-roadbed nodes such as Grand Central into a single named intersection rather than separate candidates.
- Street-segment buffers in addition to single-corner circles.
- Petition and permit support for Open Streets applications, and editable exports.

## Screenshot to upload

[`docs/assets/screenshot-report.jpg`](./assets/screenshot-report.jpg) — a live report for E 40 ST at 5 AVE at W 40 ST against real 2025 NYPD data.

Re-verified against production on 2026-08-16: 6 crashes, 7 people injured, 1 person killed, Priority Zone **Matched**, all three sources `available`, zero console errors.

## Thumbnail to upload

[`docs/assets/devpost-thumbnail.png`](./assets/devpost-thumbnail.png) — 1200×800 (3:2), matches Devpost's recommended ratio.

## Image gallery to upload

All five are 1200×800 PNGs (3:2), captured live against `localhost:3000` on 2026-08-16, well under the 5 MB cap. Upload in this order; the **Caption** line under each is copy-paste text for Devpost's per-image caption field (140-character limit — each is under it).

1. [`docs/assets/gallery/01-map-selection.png`](./assets/gallery/01-map-selection.png)

   Caption: `Pick any official NYC intersection — click the map or use the keyboard-accessible list of the same candidates.` (110 chars)

2. [`docs/assets/gallery/02-keyboard-accessible-list.png`](./assets/gallery/02-keyboard-accessible-list.png)

   Caption: `Mouse-only isn't enough. Every map intersection is also in a focusable list — zero a11y violations in CI.` (105 chars)

3. [`docs/assets/gallery/03-honest-zero-results.png`](./assets/gallery/03-honest-zero-results.png)

   Caption: `PARK AVE at E 41 ST: zero pedestrians injured or killed. A real zero, reported as a zero — never as "safe."` (107 chars)

4. [`docs/assets/gallery/04-safety-report.png`](./assets/gallery/04-safety-report.png)

   Caption: `E 40 ST at 5 AVE at W 40 ST: crashes, injuries, fatalities, and a road-user breakdown from live 2025 NYPD data.` (111 chars)

5. [`docs/assets/gallery/05-sourced-and-honest.png`](./assets/gallery/05-sourced-and-honest.png)

   Caption: `Every figure traces to a dataset ID, its role, status, and retrieval time — printed on the report itself.` (105 chars)
