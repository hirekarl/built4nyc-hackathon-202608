# EZStreet

Entry for the **Built for NYC: AI Hackathon**, presented by The New York Public Library (NYPL) and Major League Hacking (MLH), Aug 15–16, 2026, at the Stavros Niarchos Foundation Library (SNFL).

EZStreet lets a New Yorker select an official street intersection and generate a sourced safety report for the surrounding 50-meter area. The report uses NYC Open Data to show crashes, injuries, deaths, road-user breakdowns, contributing factors, Priority Zone context, data limitations, and source provenance.

## The problem

NYC collision data is public, but answering a local question such as “What has been reported around this intersection?” still requires GIS knowledge, dataset research, and careful interpretation. EZStreet turns that work into a visible, repeatable map-to-report flow without inventing missing facts or making unsupported claims about whether a street is safe.

## How it works

1. The map loads official NYC Street Centerline data for the current viewport.
2. The user hovers over and selects one official surface-street intersection.
3. EZStreet shows the official intersection name and a fixed 50-meter analysis boundary.
4. The server queries calendar-year 2025 collision records within that boundary and computes all report facts deterministically.
5. The report displays metrics, Priority Zone context, limitations, and links to its NYC Open Data sources.
6. The user can print or download the same report shown on screen.

If a required source or metric is unavailable, EZStreet labels the result **Partial**, keeps any valid results, identifies the missing data, and offers a retry. It never converts a failed request into a zero.

## Data sources

| Dataset | Socrata ID | Purpose |
| --- | --- | --- |
| Motor Vehicle Collisions - Crashes | `h9gi-nx95` | Core safety metrics queried within the 50-meter circle |
| VZV Priority Zones or Areas | `qzji-nvbd` | Priority-area overlap context; the dataset has no zone name or ID |
| NYC Street Centerline | `inkn-q76z` | Selectable street geometry, official names, nodes, and physical IDs |

The MVP targets the **Best Use of NYC Open Data** track alongside the General category. See [`docs/prd.md`](./docs/prd.md) for the product and frontend requirements, [`docs/adr/`](./docs/adr/README.md) for accepted decisions, [`docs/knowledge-base/`](./docs/knowledge-base/README.md) for dataset and framework evidence, and [`docs/plans/ezstreet-implementation-plan.md`](./docs/plans/ezstreet-implementation-plan.md) for the step-by-step build plan.

## Optional features after the core flow

- A user-triggered **Explain this report** action that gives the model only the structured report. AI may explain facts but cannot calculate, change, or hide them.
- Native Google Street View Pegman for visual context, with a custom draggable person as a later option.
- Petition or permit support, user observations, a street-segment buffer, and editable exports.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS v4, MapLibre GL JS, and OpenFreeMap Bright, deployed on Vercel. The model provider for the optional explanation remains a team implementation decision.

## Status

The app is scaffolded but still shows a placeholder page. The map, report API, report UI, download, Priority Zone check, and optional AI explanation are not implemented yet. See [`docs/plans/ezstreet-implementation-plan.md`](./docs/plans/ezstreet-implementation-plan.md) for the phased build plan and current checklist.

## Workflow

- Feature branches and pull requests only; no direct commits to `main`.
- Rebase before merge.
- Conventional Commits, enforced by commitlint.
- TDD with the repository's coverage gate.
- Markdown formatting and linting through the existing npm scripts.

See [`CLAUDE.md`](./CLAUDE.md) for the complete engineering workflow and [`docs/README.md`](./docs/README.md) for the documentation index.

## Submission

Deadline: **2:00 PM ET, Sunday, August 16, 2026**, via Devpost at [on.nypl.org/hack-dev](https://on.nypl.org/hack-dev).
