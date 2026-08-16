---
type: demo-script
status: draft
source: drafted 2026-08-16 for the 2:15 PM live judging round
---

# EZStreet — live demo script (~3 minutes)

For the in-person judging round, 7th floor SNFL, Sunday 2:15 PM. Presenter drives the live app at <https://ezstreet.vercel.app> on screen.

**The whole pitch hangs on one fact:** SNFL is **455 Fifth Avenue, at 40th Street**. `E 40 ST at 5 AVE at W 40 ST` — our PRD §12 acceptance case — is the corner immediately outside this building. Every number below was re-verified against live production at 11:34 AM today. Open on that corner.

Spoken lines are plain text. `[Bracketed italics]` are stage directions, not spoken. Lines marked **(cut)** are the first things to drop if you are running long.

---

## Beat 1 — Hook (0:00–0:25)

_[App already open, map centered on Bryant Park / Grand Central. Nothing selected yet.]_

> 455 Fifth Avenue. This building. The corner right outside — 40th and Fifth.
>
> In 2025, six crashes were reported within fifty meters of that corner. Seven people were injured. One person was killed.
>
> None of us knew that before this weekend. We found out because we built the thing that could tell us.

**Delivery note:** state the fatality plainly and move on. No pause for effect, no grimace. The product's whole ethic is reporting the record without editorializing — the pitch should sound the same way.

## Beat 2 — The problem (0:25–0:50)

> All of that is already public. NYPD publishes every reported collision. It is on NYC Open Data right now.
>
> But to get from "my corner" to that answer, you need to know three separate datasets, know that **NYC publishes no intersection dataset at all**, and write a geospatial query in Socrata's query language.
>
> A parent, a block association, a community board member is not going to do that. So the data is public and effectively out of reach. **(cut: last sentence)**

## Beat 3 — The live demo (0:50–2:00)

> This is EZStreet. It is live, no signup, no API key.

_[Hover slowly across two or three intersections so judges see the hover highlight and street names.]_

> These are real NYC street centerlines for whatever is in the viewport. I am hovering the city's own record — I am not dropping a pin. Because NYC publishes no intersection dataset, we derive them: group centerline endpoints on an exact coordinate key, and require at least two distinct official street names before it becomes selectable.

_[Click the 40th & 5th intersection. Let the 50 m circle draw.]_

> Here is our corner — under the official name the city uses for it — and a fixed fifty-meter analysis boundary. The **server** owns that radius. The browser cannot change it, and the server re-resolves this selection against official centerline data before it trusts a single field of it. **(cut: second sentence)**

_[Click **Generate safety report**. Say the next line over the loading state — do not narrate silence.]_

> It is querying NYC Open Data live, right now, while we stand here.

_[Report renders. Scroll at a readable pace as you hit each section.]_

> Headline facts: six crashes, seven injured, one killed.
>
> Road users: four pedestrians injured, one killed. One cyclist injured. Two motorists injured.
>
> Ranked contributing factors — driver inattention leads with four. And `Unspecified` is counted on its own line, rather than quietly folded into the others.
>
> This boundary overlaps a Vision Zero priority area.
>
> And every source is cited on the report itself: dataset name, Socrata ID, retrieval status, timestamp, and a link.

_[Click **Print or save as PDF**. Show the print document for ~3 seconds, then close it.]_

> It prints as its own document, not a screenshot of the panel — because the artifact a community board actually asks for is a piece of paper with the city's numbers and citations on it.

## Beat 4 — Why it's different (2:00–2:35)

> Here is the part we most want you to notice.
>
> There is **no language model anywhere in this data path.** Not one. Every count, every rollup, every status is computed deterministically on the server. The same corner produces the same report every time.
>
> If a source degrades, the report says **Partial**, keeps the valid facts, and names what is missing. A missing value renders as "Unavailable" — never as a zero. Those two things mean opposite things, and we never conflate them.
>
> And it will not grade your street. A zero is reported as a zero, not as a verdict that a corner is safe.

## Beat 5 — AI usage, and what we learned (2:35–2:55)

_[Rubric beat: "AI Usage & Technology" and "Learning" are scored directly. Say this crisply — it is not filler.]_

> We did build it with AI — Claude Code and Codex CLI, four agent roles on a contract checked into the repo. The agent that writes the failing tests structurally **cannot** write implementation code, so TDD actually held.
>
> But `main` requires a human approving review — no agent merged its own work. CI enforces ninety percent coverage and a zero-violation accessibility scan. And we scoped an "Explain this report" feature and deliberately cut it rather than ship it unbounded against a deadline. For a tool that reports a death at a specific corner, a confident wrong number is worse than no feature.
>
> What we learned: how to derive intersections from raw centerline data — and that most of "responsible AI" turned out to be deciding where the model does **not** go. **(cut: first clause)**

## Beat 6 — Close (2:55–3:00)

> EZStreet. Street facts, clearly sourced. It's live at ezstreet dot vercel dot app.

---

## Pre-flight checklist (do these before 2:15)

1. Load <https://ezstreet.vercel.app> on the presenting machine **and complete one full report** — this warms the Vercel function and the cached priority-zone polygons, so the judged run is fast.
2. Leave the map on the Bryant Park / Grand Central default view, nothing selected.
3. Browser zoom so the report drawer text is legible from a few feet back. Close devtools. Silence notifications.
4. Have `docs/assets/screenshot-report.jpg` open in a background tab as the WiFi fallback.
5. Confirm the numbers have not moved — NYPD backfills this dataset continuously:

   ```bash
   npm run test:e2e:live
   ```

   If the counts have shifted, **read the new numbers off the screen** rather than the ones in this script. Do not correct yourself mid-pitch; just say what the app says.

## If something breaks

- **Map won't load / WiFi dies:** switch to the screenshot tab and keep talking. Say: "The live demo is at ezstreet.vercel.app and it was up ten minutes ago — here is the report it produces." Do not debug in front of judges.
- **Report comes back Partial:** this is a gift, not a failure. Say: "This is exactly the case we designed for — a source degraded, so it says Partial, keeps what it verified, and names what's missing. It did not invent a zero."
- **Numbers differ from this script:** read the screen. The dataset is continuously backfilled and that is itself a point in your favor — mention it in one clause and move on.

## Likely judge questions

| Question | Answer |
| --- | --- |
| "Where's the AI?" | In how it was built, not in what it reports — and that was the deliberate call. Four agent roles, TDD enforced structurally, human review required to merge. No model touches a number. |
| "Why only 2025?" | A complete calendar year, so no partial-year comparison is misleading. Multi-year is a date control, not a rearchitecture. |
| "Why 50 meters?" | Server-authoritative and fixed, so two people analyzing the same corner get the same report. Recorded in ADR-0003. |
| "Is this real data or cached?" | Live at request time, three NYC Open Data datasets, queried when you clicked. No database in the app at all. |
| "What would you do next?" | Multi-year trend, the bounded "Explain this report" feature we deferred, and segment-level analysis for a whole block rather than one node. |
| "Best Use of NYC Open Data?" | Three datasets, three distinct roles — and the non-obvious part is that NYC publishes no intersection dataset, so the selection layer had to be derived from centerline endpoint grouping. |

## Timing

| Beat             | Target | Running |
| ---------------- | ------ | ------- |
| 1 Hook           | 0:25   | 0:25    |
| 2 Problem        | 0:25   | 0:50    |
| 3 Live demo      | 1:10   | 2:00    |
| 4 Differentiator | 0:35   | 2:35    |
| 5 AI & learning  | 0:20   | 2:55    |
| 6 Close          | 0:05   | 3:00    |

Taking every **(cut)** brings this to roughly 2:30, which is the version to rehearse if the round is running behind.
