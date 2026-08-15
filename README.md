# Vision Zero Sandbox

Entry for the **Built for NYC: AI Hackathon**, presented by The New York Public Library (NYPL) and Major League Hacking (MLH), Aug 15–16, 2026, at the Stavros Niarchos Foundation Library (SNFL).

Draw a polygon over a dangerous NYC street segment and get back a data-backed safety case — live NYPD collision data scoped to that exact area, checked against DOT's Vision Zero Priority Zones — plus an AI-drafted petition letter to DOT you can review, edit, and copy or download. The app never submits anything on your behalf.

## The problem

NYC residents who see dangerous street conditions — near-misses, speeding, no safe crossing — usually know exactly where the problem is, but backing a DOT petition (Open Streets / Street Pedestrian Plaza programs) with real data means cross-referencing NYPD collision records and DOT's priority-corridor data by hand. That's more effort than most people will take on, so good petitions don't get written.

## How it works

1. Draw a polygon over a street segment or plaza-candidate area on a map.
2. The app queries live NYC collision data scoped to that exact polygon, server-side.
3. It shows a safety summary: crash counts, injuries/fatalities, top contributing factors.
4. It checks whether the polygon overlaps a DOT-designated Priority Zone and flags a match.
5. An LLM drafts a petition letter to DOT grounded in that data.
6. You review and edit the draft before copying or downloading it — nothing is auto-submitted.

## Data sources ([NYC Open Data](https://opendata.cityofnewyork.us/))

| Dataset | Socrata ID | Purpose |
| --- | --- | --- |
| Motor Vehicle Collisions - Crashes | `h9gi-nx95` | core safety data, queried per-polygon |
| VZV Priority Zones or Areas | `qzji-nvbd` | legitimacy/context anchor — Priority Zone overlap check |
| Open Streets Locations | `uiay-nctu` | avoid redundant petitions (stretch goal) |

Targeting the **Best Use of NYC Open Data** track, alongside the General category. See [`docs/prd.md`](./docs/prd.md) for full product requirements and [`docs/knowledge-base/`](./docs/knowledge-base/README.md) for dataset and framework research.

## Stack

Next.js 16 (App Router) + React 19 + Tailwind v4, deployed on Vercel, with the Vercel AI SDK powering petition drafting. Map/draw library and LLM provider are still open decisions — tracked in [`docs/knowledge-base/`](./docs/knowledge-base/README.md).

## Status

Idea locked in, app scaffolded (Next.js, tests, CI, Husky hooks) — see [`CLAUDE.md`](./CLAUDE.md) for engineering standards. Feature code (map, polygon drawing, API routes, AI drafting) isn't built yet.

## Docs

Event source material and project docs live in [`docs/`](./docs) — see [`docs/README.md`](./docs/README.md) for the full index (official rules, agenda, judging criteria, FAQs, PRD, knowledge base, ADRs).

## Workflow

- Feature branches + PRs only, merged into `main` via rebase — no direct commits to `main`.
- Conventional Commits, enforced at commit time via commitlint.
- Markdown is linted and formatted via `npm run lint:md` / `npm run format:md` (markdownlint-cli2 + Prettier), enforced by a pre-commit hook.

Full engineering standards (TDD, ≥90% coverage gate, CI) are wired up — see [`CLAUDE.md`](./CLAUDE.md) for details.

### End-to-end tests

E2E tests run via [Playwright](https://playwright.dev), with [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) scanning every page for accessibility violations. Specs live in [`e2e/`](./e2e). Run them locally with:

```sh
npx playwright install # one-time browser install
npm run test:e2e
```

They run as a blocking job in CI (`.github/workflows/ci.yml`) but are not part of the pre-commit hook, since they need a full build + running server.

## Submission

Deadline: **2:00 PM ET, Sunday, August 16, 2026**, via Devpost at [on.nypl.org/hack-dev](https://on.nypl.org/hack-dev).
