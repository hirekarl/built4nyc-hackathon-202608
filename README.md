# Built for NYC: AI Hackathon

Entry for the **Built for NYC: AI Hackathon**, presented by The New York Public Library (NYPL) and Major League Hacking (MLH), Aug 15–16, 2026, at the Stavros Niarchos Foundation Library (SNFL).

The challenge: use generative AI and "vibe coding" to build a web app that meets a challenge NYC is facing (e.g. food deserts, park utilization, access to city resources).

## Status

Project idea and app scaffold not yet locked in. See [`CLAUDE.md`](./CLAUDE.md) for the current plan and engineering standards.

## Docs

Event source material lives in [`docs/`](./docs) — see [`docs/README.md`](./docs/README.md) for the index (official rules, agenda, judging criteria, FAQs).

## Workflow

- Feature branches + PRs only, merged into `main` via rebase — no direct commits to `main`.
- Conventional Commits, enforced at commit time via commitlint.
- Markdown is linted and formatted via `npm run lint:md` / `npm run format:md` (markdownlint-cli2 + Prettier), enforced by a pre-commit hook.

Full engineering standards (TDD, coverage gate, CI) are documented in [`CLAUDE.md`](./CLAUDE.md) and get wired up once the app is scaffolded.

## Submission

Deadline: **2:00 PM ET, Sunday, August 16, 2026**, via Devpost at [on.nypl.org/hack-dev](https://on.nypl.org/hack-dev).
