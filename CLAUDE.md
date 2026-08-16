# Built for NYC: AI Hackathon — Project Repo

This repo is the entry for the **Built for NYC: AI Hackathon**, presented by The New York Public Library (NYPL) and Major League Hacking (MLH), Aug 15–16, 2026, at the Stavros Niarchos Foundation Library (SNFL). Full source docs are in `docs/` (see `docs/README.md` for the index).

## The prompt

Using generative AI and "vibe coding," build a **web app** that meets a challenge NYC is facing (e.g. food deserts, park utilization, access to city resources). See `docs/official-rules.md` for the full prompt and rules.

## Hard constraints

- **Submission deadline: 2:00 PM ET, Sunday, August 16, 2026** — submit via Devpost at [on.nypl.org/hack-dev](https://on.nypl.org/hack-dev). No extensions.
- Judging criteria: adherence to the prompt, originality of concept, potential impact — see `docs/judging-criteria.md` for the actual four-point rubric judges use (AI Usage & Technology, Design, Completion & Theme, Learning) and what it implies for the demo/presentation. Design is scored standalone from functionality — budget real time for UI polish, not just correctness.
- Only one person per team can submit; that person is responsible for splitting any prize money.
- Full rules: `docs/official-rules.md`. Event logistics/WiFi/FAQ: `docs/important-info-and-faqs.md`. Agenda: `docs/overview-and-agenda.md`.

## Target tracks

- **General category** (default, all entrants).
- **Best Use of NYC Open Data** — must use a dataset from [opendata.cityofnewyork.us](https://opendata.cityofnewyork.us/) in a novel way. Use the `nyc-open-data-scout` agent to find and wire up a relevant dataset.

## Stack & workflow

- **Next.js (App Router)**, deployed on **Vercel**. Use the `vercel:*` skills already available in this environment (`vercel:bootstrap`, `vercel:deploy`, `vercel:nextjs`, `vercel:vercel-storage`, etc.) for anything Vercel/Next.js-specific — don't re-derive that guidance here.
- **Project direction is locked in and scaffolded**: EZStreet. `docs/prd.md` is the product and frontend source of truth, `docs/knowledge-base/` holds dataset/framework evidence, and `docs/adr/` holds accepted architecture decisions.
- **Build plan**: `docs/plans/ezstreet-implementation-plan.md` is the step-by-step, TDD-ready implementation plan (frontend → backend → integration, per [issue #21](https://github.com/hirekarl/ezstreet/issues/21)'s ownership split) — every checklist item there is a pre-written `[SPEC]`/`[SPIKE]` + `[FORCES]` block ready to relay to `sdet`/`builder`.
- **Already linked to the `ezstreet` Vercel project** (`.vercel/project.json`, gitignored) — no bootstrap or relink needed. See `docs/infra.md`. `SOCRATA_APP_TOKEN` is **not yet provisioned** in any environment; every adapter works without it at demo volume, but add it via `vercel env` before relying on preview/production rate limits.
- **Accepted core decisions**: select official intersections with a 50-meter boundary (ADR-0003), use MapLibre GL JS with OpenFreeMap Bright (ADR-0004), and generate the sourced safety report deterministically (ADR-0005). The official NYC Street Centerline SODA dataset is `inkn-q76z`.
- **Optional AI setup remains open**: the model/provider and access test for `Explain this report` are team implementation decisions. AI work must not block the deterministic map-to-report slice.
- Before submitting, run the `devpost-submission-checklist` skill.

## Commands

- `npm run dev` — local dev server. `npm run build` / `npm run start` — production build/serve.
- `npm run lint` / `npm run format` / `npm run format:check` — app code (ESLint/Prettier).
- `npm run lint:md` / `npm run format:md` / `npm run format:md:check` — docs (markdownlint-cli2/Prettier).
- `npm run test` — vitest with coverage; this is what enforces the 90% gate.
- `npm run test:e2e` / `npm run test:e2e:ui` — Playwright, including an `@axe-core/playwright` accessibility scan (see `e2e/home.spec.ts`). Use this as the Verification Oracle for anything interaction/DOM-layer that vitest + jsdom can't faithfully express.

## Git workflow

- **Feature branches + PRs only — never commit directly to `main`.** Branch from `main`, open a PR, merge via GitHub.
- **Rebase is the merge strategy**, enforced at the GitHub repo level (squash and merge-commit are disabled). Keep feature branches rebased on `main` before merging to avoid conflicts at merge time.
- Branches are auto-deleted on merge.

## Engineering standards

- **TDD, ≥90% test coverage.** Write the failing test before the implementation. Coverage is enforced in CI/pre-commit — treat a coverage drop below 90% as a build failure, not a warning.
- **Accessibility is tested, not assumed.** `e2e/home.spec.ts` runs an `@axe-core/playwright` scan against the rendered page (`npm run test:e2e`) — any new page/route should get the same scan added, not just a manual visual check. This is the automated backstop for the Design/accessibility judging criterion above.
- **Node ≥22, npm ≥12 — pinned via `.nvmrc` and `package.json` `engines`.** An older npm (e.g. the 10.9.x some Node 22 installs bundle by default) silently drops `libc` metadata from `package-lock.json` and reintroduces lockfile drift. If you ever regenerate the lockfile, check `npm -v` first (`npm install -g npm@latest` if it's below 12).
- **LF line endings everywhere**, enforced via `.gitattributes` (`* text=auto eol=lf`) — don't bypass it.
- **Pre-commit hooks** (Husky, already installed) currently run lint-staged on `*.md` (`markdownlint-cli2` + `prettier --write`) plus the app's own lint/format, plus the full test suite before every commit. Don't commit with `--no-verify`; if a hook fails, fix the underlying issue.
- **Conventional Commits, enforced at commit time.** `.husky/commit-msg` runs `commitlint` (`commitlint.config.cjs`, extends `@commitlint/config-conventional`) — non-conventional commit messages (e.g. missing a `type:` prefix) are rejected.
- **No AI `Co-Authored-By` trailers.** The same `commit-msg` hook rejects any `Co-Authored-By:` trailer that names an AI tool (Claude, Anthropic, OpenAI, ChatGPT, GPT-, Copilot, Gemini, Codex, or the word "AI"). When Claude Code commits in this repo, it must not add its usual `Co-Authored-By: Claude ... <noreply@anthropic.com>` trailer — the hook will block it.
- **CI via GitHub Actions** (`.github/workflows/ci.yml`) re-runs lint, format check, `npm run typecheck`, tests, the ≥90% coverage gate, and `npm run build` on every push/PR — the pre-commit hook is a deliberately narrower fast local gate (lint-staged + the test suite), CI is the authoritative one. The gap is intentional: `vitest` does not type-check and neither does ESLint, so **a type error in a test file is invisible locally until `npm run typecheck` or `npm run build` runs**. Run `npm run typecheck` yourself before pushing.
- **SOLID + established design patterns** when architecting non-trivial modules — favor small, single-responsibility components/functions, dependency inversion at integration boundaries (e.g. the Open Data client behind an interface, not fetch calls scattered through components), and named patterns (factory, strategy, adapter, etc.) where they clarify intent. Don't apply patterns ceremonially to trivial code — a weekend hackathon app still favors the simplest thing that satisfies SOLID, not maximal abstraction.
- **Markdown lint + format**: `npm run lint:md` (markdownlint-cli2, config at `.markdownlint-cli2.jsonc`, with an `MD041` override in `.claude/.markdownlint-cli2.jsonc` for frontmatter-led agent/skill files) and `npm run format:md` (Prettier, `.prettierrc.json` sets `proseWrap: "never"` so paragraphs stay on one unwrapped line instead of hard-wrapping — GFM tables are supported natively and get column-aligned on format). Both are wired into pre-commit/CI alongside the app's own lint/format/test.

## Multi-agent build workflow

This is a **team project** — anyone on the team can dispatch these agents, so the handoff protocol below is the shared contract, not one person's convention. The idea (EZStreet — `docs/prd.md`), core architecture (`docs/adr/`), and verified Open Data rules (`docs/knowledge-base/`) are locked in. `docs/plans/ezstreet-implementation-plan.md` sequences all of this into phased, ownership-assigned steps — pull each task's `[SPEC]`/`[SPIKE]` + `[FORCES]` block straight from there rather than re-deriving one from scratch. Feature work for the app itself flows through a lean 3-agent roster (`.claude/agents/`), role-named (not aliased) so any teammate can tell what an agent does without cross-referencing a roster:

| Agent | Role | May edit files? | When |
| --- | --- | --- | --- |
| `tech-lead` | Plans | No (read-only) | Non-trivial feature asks — turns them into a `[SPEC]` (≤5 files, names a Verification Oracle, states the Bounded-AI boundary). Skip for trivial one-file changes. |
| `sdet` | Tests | Tests only | Writes the failing test first (TDD red) per the SPEC's oracle, then audits `builder`'s work — PASS/FAIL incl. the 90% coverage gate. |
| `builder` | Implements | Yes | Single full-stack implementer for the assigned API, data, UI, or optional AI slice — makes `sdet`'s red go green. |
| `reviewer` | Mediates/refactors | Yes (refactors) | **On-demand only.** Mediates after 2 failed `sdet` cycles on the same task, or handles a tree-wide mechanical refactor. |

**What's deliberately cut**, to keep ceremony proportional to a 24-hour build: no dedicated routing/context-scout agents (the orchestrating session does this directly), no `SESSION_STATE.md` ledger (git history + the PRD are enough continuity for a weekend), no per-task `specs/NNN-slug.md` files (a `[SPEC]` is relayed inline in the handoff, not persisted) — the only persisted decision trail is `docs/adr/` for decisions that are costly to reverse, using the existing `docs/adr/template.md`.

**Bounded-AI boundary** (the one rule that's non-negotiable regardless of ceremony level): every crash count, injury/fatality tally, contributing-factor rollup, Priority Zone overlap, completeness status, and source limitation is computed deterministically before any LLM call. The optional model receives only the structured report and may explain it in plain language. It never computes or changes facts, claims causation or safety, hides a partial status, or controls whether the factual report renders.

**Default flow:** non-trivial ask → `tech-lead` (`[SPEC]`) → `sdet` (red) → `builder` (green) → `sdet` (audit) → merge. Trivial changes skip straight to `builder`. This composes with, not replaces, the existing TDD/coverage/Conventional-Commits/no-AI-trailer rules above — the agents are how those rules get executed, not an additional layer on top of them.

### Handoff Schemas

Canonical location — the agent files in `.claude/agents/` reference these by name and must not restate or vary them. If a schema needs to change, change it here first so every agent stays in sync.

**`[SPEC]` / `[SPIKE]`** — `tech-lead` → `sdet` → `builder`

```markdown
[SPEC] / [SPIKE]

- **Objective**: <what the code must achieve>
- **Inputs/Outputs**: <types, shapes, API contract>
- **Bounded-AI boundary**: <deterministic vs. LLM-generated — required if the task touches the optional explanation path>
- **Verification Oracle**: <REQUIRED. Where the failure is observable — a vitest/RTL test, a Playwright flow, an API route test>
- **Constraints**: <performance, forbidden libraries, style>
- **Edge Cases**: <error handling, invalid intersection, partial report, zero-crash result, LLM failure/timeout>
- **Files**: <max 5 files this task may touch>
```

**`[FORCES]`** — attached to every `[SPEC]`/`[SPIKE]`

```markdown
[FORCES]

1. <Primary force> > <Secondary force>
```

No default force is imposed — `tech-lead` states the actual trade-off for the task at hand rather than falling back to a fixed hierarchy.

**`[COMPLIANCE-REPORT]`** — `sdet` → `tech-lead` / `builder`

```markdown
[COMPLIANCE-REPORT]

- **Status**: PASS | FAIL
- **Oracle run**: <the SPEC's declared oracle, the exact command, and its verdict>
- **Coverage**: <current %, PASS/FAIL against the 90% gate>
- **Bounded-AI check**: <held / violated — where>
- **Critical violations**: <must fix before merge; empty if PASS>
- **Recommendations**: <non-blocking improvements>
```

**`[COMPLETION-REPORT]`** — `builder` → `sdet`

```markdown
[COMPLETION-REPORT]

- **Files changed**: <list>
- **Spec items satisfied**: <checklist against the SPEC>
- **Oracle status**: <the declared oracle, the command run, and its verdict>
- **Bounded-AI boundary**: <confirm what's deterministic vs. LLM-generated, if the task touched the optional explanation path>
- **Known gaps**: <anything deferred, or "none">
```

**Rejection loop (circuit breaker):** `sdet` FAIL → `builder` retries in the same continuation, not a fresh dispatch. After 2 failed cycles on the same task, stop and escalate to `reviewer` — don't retry a third time.

## Notes

- This is a weekend hackathon repo, not a long-lived codebase — favor speed and a working demo over architectural polish.
- **`AGENTS.md` mirrors this file for the teammate on Codex CLI** (which doesn't read `CLAUDE.md`, `.claude/agents/`, or `.claude/skills/`) — Codex-facing versions of the active roles and submission checklist live in `.codex/agents/*.toml` and `.agents/skills/`. Keep both files in sync when a rule changes.
- **Current app surface**: a full-viewport MapLibre map with intersection selection and a collapsible report drawer (`src/app/page.tsx`, `src/components/`), plus one API route — `POST /api/reports/intersection`, which returns the deterministic report defined in `docs/contract.md`. Server modules live in `src/lib/adapters/` (centerline, collisions, priority-zones), `src/lib/validation.ts`, and `src/lib/report.ts`.
- **The UI is still mock-driven**: `src/app/page.tsx` renders from `src/lib/mocks/report.mock.ts` and does not yet call the route. Wiring them together is Phase 3 Step 3.1 in `docs/plans/ezstreet-implementation-plan.md`.
- **Environment variables**: `SOCRATA_APP_TOKEN` only — server-only, optional, read by the three adapters and sent as `X-App-Token`.
