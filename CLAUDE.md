# Built for NYC: AI Hackathon — Project Repo

This repo is the entry for the **Built for NYC: AI Hackathon**, presented by The New York Public Library (NYPL) and Major League Hacking (MLH), Aug 15–16, 2026, at the Stavros Niarchos Foundation Library (SNFL). Full source docs are in `docs/` (see `docs/README.md` for the index).

## The prompt

Using generative AI and "vibe coding," build a **web app** that meets a challenge NYC is facing (e.g. food deserts, park utilization, access to city resources). See `docs/official-rules.md` for the full prompt and rules.

## Hard constraints

- **Submission deadline: 2:00 PM ET, Sunday, August 16, 2026** — submit via Devpost at [on.nypl.org/hack-dev](https://on.nypl.org/hack-dev). No extensions.
- Judging criteria: adherence to the prompt, originality of concept, potential impact.
- Only one person per team can submit; that person is responsible for splitting any prize money.
- Full rules: `docs/official-rules.md`. Event logistics/WiFi/FAQ: `docs/important-info-and-faqs.md`. Agenda: `docs/overview-and-agenda.md`.

## Target tracks

- **General category** (default, all entrants).
- **Best Use of NYC Open Data** — must use a dataset from [opendata.cityofnewyork.us](https://opendata.cityofnewyork.us/) in a novel way. Use the `nyc-open-data-scout` agent to find and wire up a relevant dataset.

## Stack & workflow

- **Next.js (App Router)**, deployed on **Vercel**. Use the `vercel:*` skills already available in this environment (`vercel:bootstrap`, `vercel:deploy`, `vercel:nextjs`, `vercel:vercel-storage`, etc.) for anything Vercel/Next.js-specific — don't re-derive that guidance here.
- No project idea is locked in yet. Use the `idea-brainstormer` agent to converge on one scoped to a weekend build, ideally with a plausible NYC Open Data angle.
- Once scaffolding is needed, use the `scaffold-nextjs-app` skill, which also wires up the engineering standards below (hooks, lint/format config, test setup).
- Before submitting, run the `devpost-submission-checklist` skill.

## Git workflow

- **Feature branches + PRs only — never commit directly to `main`.** Branch from `main`, open a PR, merge via GitHub.
- **Rebase is the merge strategy**, enforced at the GitHub repo level (squash and merge-commit are disabled). Keep feature branches rebased on `main` before merging to avoid conflicts at merge time.
- Branches are auto-deleted on merge.

## Engineering standards

- **TDD, ≥90% test coverage.** Write the failing test before the implementation. Coverage is enforced in CI/pre-commit — treat a coverage drop below 90% as a build failure, not a warning.
- **LF line endings everywhere**, enforced via `.gitattributes` (`* text=auto eol=lf`) — don't bypass it.
- **Pre-commit hooks** (Husky, already installed) currently run lint-staged on `*.md` (`markdownlint-cli2` + `prettier --write`); `scaffold-nextjs-app` extends the same `lint-staged` config with the app's own lint/format, plus the full test suite before every commit. Don't commit with `--no-verify`; if a hook fails, fix the underlying issue.
- **Conventional Commits, enforced at commit time.** `.husky/commit-msg` runs `commitlint` (`commitlint.config.cjs`, extends `@commitlint/config-conventional`) — non-conventional commit messages (e.g. missing a `type:` prefix) are rejected.
- **No AI `Co-Authored-By` trailers.** The same `commit-msg` hook rejects any `Co-Authored-By:` trailer that names an AI tool (Claude, Anthropic, OpenAI, ChatGPT, GPT-, Copilot, Gemini, Codex, or the word "AI"). When Claude Code commits in this repo, it must not add its usual `Co-Authored-By: Claude ... <noreply@anthropic.com>` trailer — the hook will block it.
- **CI via GitHub Actions** (`.github/workflows/ci.yml`, set up by `scaffold-nextjs-app`) re-runs lint, format check, tests, and the ≥90% coverage gate on every push/PR — the pre-commit hook is a fast local gate, CI is the authoritative one. Keep them checking the same things.
- **SOLID + established design patterns** when architecting non-trivial modules — favor small, single-responsibility components/functions, dependency inversion at integration boundaries (e.g. the Open Data client behind an interface, not fetch calls scattered through components), and named patterns (factory, strategy, adapter, etc.) where they clarify intent. Don't apply patterns ceremonially to trivial code — a weekend hackathon app still favors the simplest thing that satisfies SOLID, not maximal abstraction.
- **Markdown lint + format** (repo root already set up, works today — no app scaffold needed): `npm run lint:md` (markdownlint-cli2, config at `.markdownlint-cli2.jsonc`, with an `MD041` override in `.claude/.markdownlint-cli2.jsonc` for frontmatter-led agent/skill files) and `npm run format:md` (Prettier, `.prettierrc.json` sets `proseWrap: "never"` so paragraphs stay on one unwrapped line instead of hard-wrapping — GFM tables are supported natively and get column-aligned on format). Both are wired into pre-commit/CI alongside the app's own lint/format/test once `scaffold-nextjs-app` runs.

## Multi-agent build workflow

This is a **team project** — anyone on the team can dispatch these agents, so the handoff protocol below is the shared contract, not one person's convention. The idea (Vision Zero Sandbox — `docs/prd.md`) and Open Data datasets (`docs/knowledge-base/`) are locked in. Once `scaffold-nextjs-app` has run, feature work for the app itself flows through a lean 3-agent roster (`.claude/agents/`), role-named (not aliased) so any teammate can tell what an agent does without cross-referencing a roster:

| Agent | Role | May edit files? | When |
| --- | --- | --- | --- |
| `tech-lead` | Plans | No (read-only) | Non-trivial feature asks — turns them into a `[SPEC]` (≤5 files, names a Verification Oracle, states the Bounded-AI boundary). Skip for trivial one-file changes. |
| `sdet` | Tests | Tests only | Writes the failing test first (TDD red) per the SPEC's oracle, then audits `builder`'s work — PASS/FAIL incl. the 90% coverage gate. |
| `builder` | Implements | Yes | Single full-stack implementer (API route + UI + AI SDK call) — makes `sdet`'s red go green. |
| `reviewer` | Mediates/refactors | Yes (refactors) | **On-demand only.** Mediates after 2 failed `sdet` cycles on the same task, or handles a tree-wide mechanical refactor. |

**What's deliberately cut**, to keep ceremony proportional to a 24-hour build: no dedicated routing/context-scout agents (the orchestrating session does this directly), no `SESSION_STATE.md` ledger (git history + the PRD are enough continuity for a weekend), no per-task `specs/NNN-slug.md` files (a `[SPEC]` is relayed inline in the handoff, not persisted) — the only persisted decision trail is `docs/adr/` for genuine architecture calls (map-draw library, AI provider, overlap-computation approach), using the existing `docs/adr/template.md`.

**Bounded-AI boundary** (the one rule that's non-negotiable regardless of ceremony level): every crash count, injury/fatality tally, contributing-factor rollup, and Priority Zone overlap is computed deterministically, server-side, before the single LLM call. The LLM only turns that computed summary into petition prose — it never computes or adjusts a number, and its output is validated before being rendered.

**Default flow:** non-trivial ask → `tech-lead` (`[SPEC]`) → `sdet` (red) → `builder` (green) → `sdet` (audit) → merge. Trivial changes skip straight to `builder`. This composes with, not replaces, the existing TDD/coverage/Conventional-Commits/no-AI-trailer rules above — the agents are how those rules get executed, not an additional layer on top of them.

### Handoff Schemas

Canonical location — the agent files in `.claude/agents/` reference these by name and must not restate or vary them. If a schema needs to change, change it here first so every agent stays in sync.

**`[SPEC]` / `[SPIKE]`** — `tech-lead` → `sdet` → `builder`

```markdown
[SPEC] / [SPIKE]

- **Objective**: <what the code must achieve>
- **Inputs/Outputs**: <types, shapes, API contract>
- **Bounded-AI boundary**: <deterministic vs. LLM-generated — required if the task touches the petition-draft path>
- **Verification Oracle**: <REQUIRED. Where the failure is observable — a vitest/RTL test, a Playwright flow, an API route test>
- **Constraints**: <performance, forbidden libraries, style>
- **Edge Cases**: <error handling, empty polygon, zero-crash result, LLM failure/timeout>
- **Files**: <max 5 files this task may touch>
```

**`[FORCES]`** — attached to every `[SPEC]`/`[SPIKE]`

```markdown
[FORCES]

1. <Primary force> > <Secondary force>
2. Simplicity > Pattern purity (always present unless explicitly overridden)
```

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
- **Bounded-AI boundary**: <confirm what's deterministic vs. LLM-generated, if the task touched the petition path>
- **Known gaps**: <anything deferred, or "none">
```

**Rejection loop (circuit breaker):** `sdet` FAIL → `builder` retries in the same continuation, not a fresh dispatch. After 2 failed cycles on the same task, stop and escalate to `reviewer` — don't retry a third time.

## Notes

- This is a weekend hackathon repo, not a long-lived codebase — favor speed and a working demo over architectural polish.
- Don't prescribe app structure here beyond the above; update further once the scaffold is in place if there's project-specific context worth persisting (e.g. key routes, final map-draw library choice).
